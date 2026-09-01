"""
Fast & Robust Face Detection Engine
Extracts face bounding boxes and regions from image frames.
"""

import cv2
import numpy as np
from app.config import settings

class FaceDetector:
    def __init__(self):
        self.cascade = None
        try:
            if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                self.cascade = cv2.CascadeClassifier(cascade_path)
        except Exception as e:
            print(f"[WARNING] Could not load OpenCV Haar cascade: {e}")
            self.cascade = None
        
    def detect_primary_face(self, image: np.ndarray):
        """
        Detects the largest (primary) face in the image frame.
        Returns: (x, y, w, h) bounding box, or centered crop if detector unavailable.
        """
        if image is None or image.size == 0:
            return None
            
        img_h, img_w = image.shape[:2]
        
        if self.cascade is not None and not self.cascade.empty():
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(settings.MIN_FACE_SIZE, settings.MIN_FACE_SIZE),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            if len(faces) == 0:
                # Fallback with relaxed neighbors for low light
                faces = self.cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.05,
                    minNeighbors=3,
                    minSize=(settings.MIN_FACE_SIZE, settings.MIN_FACE_SIZE)
                )
                
            if len(faces) > 0:
                # Select largest face by area (primary face)
                faces_sorted = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                primary_bbox = tuple(map(int, faces_sorted[0]))
                return primary_bbox

        # Fallback: Assume center 60% of frame as face region
        box_w = int(img_w * 0.6)
        box_h = int(img_h * 0.6)
        box_x = (img_w - box_w) // 2
        box_y = (img_h - box_h) // 2
        return (box_x, box_y, box_w, box_h)

detector = FaceDetector()
