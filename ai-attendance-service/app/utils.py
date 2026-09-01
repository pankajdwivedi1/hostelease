"""
Image processing and decoding utilities for Hostelease AI Microservice
"""

import base64
import io
import re
import cv2
import numpy as np
from PIL import Image
from app.config import settings

def decode_base64_image(image_input: str) -> np.ndarray:
    """
    Decodes base64 string (with or without data URI prefix) or raw image into an OpenCV BGR numpy array.
    """
    if not image_input or not isinstance(image_input, str):
        raise ValueError("Invalid image input: expected base64 string")
    
    # Strip any data URI header (e.g. data:image/jpeg;base64,)
    cleaned_b64 = re.sub(r"^data:image/[a-zA-Z0-9]+;base64,", "", image_input.strip())
    
    try:
        image_bytes = base64.b64decode(cleaned_b64)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Downscale if excessively large to protect memory & CPU
        w, h = pil_image.size
        max_dim = settings.MAX_IMAGE_DIMENSION
        if w > max_dim or h > max_dim:
            if w > h:
                new_w, new_h = max_dim, int(h * (max_dim / w))
            else:
                new_w, new_h = int(w * (max_dim / h)), max_dim
            pil_image = pil_image.resize((new_w, new_h), Image.Resampling.BILINEAR)
        
        # Convert RGB PIL to BGR OpenCV format
        rgb_array = np.array(pil_image)
        bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        return bgr_array
    except Exception as e:
        raise ValueError(f"Failed to decode base64 image: {str(e)}")

def crop_and_align_face(image: np.ndarray, bbox: tuple, target_size=(112, 112)) -> np.ndarray:
    """
    Crops face region with padding and resizes to target_size (default 112x112 for ArcFace).
    """
    x, y, w, h = bbox
    img_h, img_w = image.shape[:2]
    
    # Add slight margin around face (15%)
    margin_x = int(w * 0.15)
    margin_y = int(h * 0.15)
    
    x1 = max(0, x - margin_x)
    y1 = max(0, y - margin_y)
    x2 = min(img_w, x + w + margin_x)
    y2 = min(img_h, y + h + margin_y)
    
    face_crop = image[y1:y2, x1:x2]
    if face_crop.size == 0:
        face_crop = image
        
    resized_face = cv2.resize(face_crop, target_size, interpolation=cv2.INTER_LINEAR)
    return resized_face
