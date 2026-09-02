"""
FastAPI Microservice Entrypoint for Hostelease Face Attendance AI
Provides high-performance Anti-Spoofing & ArcFace Verification endpoints.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import time

from app.config import settings
from app.utils import decode_base64_image
from app.detector import detector
from app.anti_spoof import anti_spoof_engine
from app.face_recognizer import face_recognizer

app = FastAPI(
    title="Hostelease AI Attendance Service",
    version="1.0.0",
    description="Dedicated Biometric & Anti-Spoofing Microservice (ArcFace + MiniFASNet)"
)

# Enable CORS for Next.js / frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class VerifyRequest(BaseModel):
    live_image: str = Field(..., description="Base64 encoded live camera capture")
    reference_image: Optional[str] = Field(None, description="Base64 profile picture")
    reference_descriptor: Optional[List[float]] = Field(None, description="Stored 512-D face vector")

class ExtractDescriptorRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded face photo")

class LivenessRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded camera frame")


@app.get("/")
def root():
    return {
        "service": "Hostelease AI Biometrics",
        "version": "1.0.0",
        "status": "online",
        "match_threshold": settings.MATCH_THRESHOLD
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "arcface_loaded": face_recognizer.session is not None,
        "antispoof_loaded": anti_spoof_engine.session is not None,
        "execution_provider": settings.EXECUTION_PROVIDER
    }


@app.post("/verify")
async def verify_face(req: VerifyRequest):
    """
    1. Detects face in live image.
    2. Runs MiniFASNet anti-spoofing to reject screens, paper, and video replays.
    3. Extracts 512-D ArcFace embedding and matches against reference.
    """
    start_time = time.time()
    
    # 1. Decode live image
    try:
        live_bgr = decode_base64_image(req.live_image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Live image decode error: {str(e)}")

    # 2. Detect face in live camera frame
    live_bbox = detector.detect_primary_face(live_bgr)
    if live_bbox is None:
        return {
            "success": False,
            "is_spoof": False,
            "is_match": False,
            "score": 0.0,
            "message": "No face detected in live camera. Please look directly at the camera."
        }

    # 3. MiniFASNet Anti-Spoofing Verification
    liveness_result = anti_spoof_engine.check_liveness(live_bgr, live_bbox)
    if liveness_result["is_spoof"]:
        return {
            "success": True,
            "is_spoof": True,
            "is_match": False,
            "score": 0.0,
            "liveness_score": liveness_result["liveness_score"],
            "message": f"❌ Anti-Spoof Warning: {liveness_result['reason']}"
        }

    # 4. Extract live 512-D ArcFace descriptor
    live_embedding = face_recognizer.extract_embedding(live_bgr, live_bbox)
    if not live_embedding:
        return {
            "success": False,
            "is_spoof": False,
            "is_match": False,
            "score": 0.0,
            "message": "Could not extract biometric features from live face."
        }

    # 5. Resolve reference descriptor (Ensure 512-D vector, or extract from reference image)
    ref_embedding = req.reference_descriptor if (req.reference_descriptor and len(req.reference_descriptor) == 512) else None
    if not ref_embedding and req.reference_image:
        try:
            ref_bgr = decode_base64_image(req.reference_image)
            ref_bbox = detector.detect_primary_face(ref_bgr)
            if ref_bbox is not None:
                ref_embedding = face_recognizer.extract_embedding(ref_bgr, ref_bbox)
        except Exception as e:
            print(f"Could not extract reference image descriptor: {e}")

    if not ref_embedding or len(ref_embedding) == 0:
        return {
            "success": False,
            "is_spoof": False,
            "is_match": False,
            "score": 0.0,
            "message": "No registered reference face found for comparison."
        }

    # 6. Biometric Comparison
    match_result = face_recognizer.compare_embeddings(live_embedding, ref_embedding)
    elapsed_ms = round((time.time() - start_time) * 1000, 1)

    return {
        "success": True,
        "is_spoof": False,
        "is_match": match_result["is_match"],
        "score": match_result["score"],
        "distance": match_result["distance"],
        "liveness_score": liveness_result["liveness_score"],
        "latency_ms": elapsed_ms,
        "message": "Identity Verified" if match_result["is_match"] else "Identity Mismatch"
    }


@app.post("/extract-descriptor")
async def extract_descriptor(req: ExtractDescriptorRequest):
    """
    Extracts high-precision 512-D ArcFace vector for student profile registration.
    """
    try:
        image_bgr = decode_base64_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode error: {str(e)}")

    bbox = detector.detect_primary_face(image_bgr)
    if bbox is None:
        return {
            "success": False,
            "error": "No clear face detected in the photo. Please use a clear front-facing photo."
        }

    embedding = face_recognizer.extract_embedding(image_bgr, bbox)
    if not embedding:
        return {
            "success": False,
            "error": "Failed to extract face vector."
        }

    return {
        "success": True,
        "descriptor": embedding,
        "dimension": len(embedding)
    }


@app.post("/check-liveness")
async def check_liveness_only(req: LivenessRequest):
    """
    Standalone liveness / anti-spoof check endpoint.
    """
    try:
        image_bgr = decode_base64_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode error: {str(e)}")

    bbox = detector.detect_primary_face(image_bgr)
    if bbox is None:
        return {"is_live": False, "is_spoof": True, "reason": "No face found"}

    return anti_spoof_engine.check_liveness(image_bgr, bbox)
