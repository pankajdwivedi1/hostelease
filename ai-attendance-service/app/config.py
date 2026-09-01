"""
Configuration Settings for Hostelease AI Attendance Microservice
All thresholds, model paths, and server parameters are configured here.
"""

import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class AISettings(BaseModel):
    # Server configuration
    HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    DEBUG: bool = os.getenv("AI_DEBUG", "false").lower() == "true"
    
    # Model storage directory
    MODELS_DIR: str = os.getenv(
        "MODELS_DIR", 
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    )
    
    # ArcFace 512-D Face Recognition settings
    ARCFACE_MODEL_FILENAME: str = "arcface_r50.onnx"
    # Cosine distance cutoff: 0.35 distance ≈ 85% match, 0.28 ≈ 92% match
    MATCH_THRESHOLD: float = float(os.getenv("MATCH_THRESHOLD", "85.0"))
    
    # MiniFASNet Anti-Spoofing settings
    ANTISPOOF_MODEL_FILENAME: str = "2.7_80x80_MiniFASNetV2.onnx"
    # Liveness confidence threshold (0.0 to 1.0)
    SPOOF_CONFIDENCE_THRESHOLD: float = float(os.getenv("SPOOF_CONFIDENCE_THRESHOLD", "0.80"))
    
    # Preprocessing limits
    MAX_IMAGE_DIMENSION: int = 1280
    MIN_FACE_SIZE: int = 40  # pixels
    
    # Device execution (cpu, cuda)
    EXECUTION_PROVIDER: str = os.getenv("EXECUTION_PROVIDER", "CPUExecutionProvider")

settings = AISettings()
