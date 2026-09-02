"""
MiniFASNet Anti-Spoofing & Presentation Attack Detection (PAD) Engine
Detects digital mobile screens, video replays, tablet displays, and printed photos.
"""

import os
import cv2
import numpy as np
import onnxruntime as ort
from app.config import settings
from app.utils import crop_and_align_face

class AntiSpoofEngine:
    def __init__(self):
        self.session = None
        self.model_path = os.path.join(settings.MODELS_DIR, settings.ANTISPOOF_MODEL_FILENAME)
        self._initialize_onnx()
        
    def _initialize_onnx(self):
        """Attempts to load MiniFASNet ONNX model if available."""
        if os.path.exists(self.model_path):
            try:
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 2
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=opts,
                    providers=[settings.EXECUTION_PROVIDER, "CPUExecutionProvider"]
                )
                print(f"[SUCCESS] MiniFASNet Anti-Spoof Model loaded from {self.model_path}")
            except Exception as e:
                print(f"[WARNING] Could not load MiniFASNet ONNX: {e}. Using High-Frequency Texture & Moire Analysis.")
                self.session = None
        else:
            print(f"[INFO] MiniFASNet model not found at {self.model_path}. Using Advanced Vision PAD Analyzer.")

    def check_liveness(self, image: np.ndarray, bbox: tuple) -> dict:
        """
        Evaluates the face image for presentation attacks (screens, replays, printed photos).
        Returns:
            {
                "is_live": bool,
                "is_spoof": bool,
                "liveness_score": float (0.0 to 100.0),
                "reason": str
            }
        """
        if image is None or bbox is None:
            return {
                "is_live": False,
                "is_spoof": True,
                "liveness_score": 0.0,
                "reason": "No face region available for liveness verification."
            }
            
        x, y, w, h = bbox
        img_h, img_w = image.shape[:2]
        
        # 1. Check crop bounds
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(img_w, x + w), min(img_h, y + h)
        face_crop = image[y1:y2, x1:x2]
        
        if face_crop.size == 0 or w < 30 or h < 30:
            return {
                "is_live": False,
                "is_spoof": True,
                "liveness_score": 0.0,
                "reason": "Face is too small or out of frame."
            }

        # 2. FULL-FRAME DEVICE BEZEL & PHONE DISPLAY RECTANGLE DETECTION
        full_gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        col_means = np.mean(full_gray, axis=0)
        
        left_third_idx = int(img_w * 0.35)
        right_third_idx = int(img_w * 0.65)
        
        left_min_col = np.min(col_means[:left_third_idx]) if left_third_idx > 0 else 255
        right_min_col = np.min(col_means[right_third_idx:]) if right_third_idx < img_w else 255
        center_mean = np.mean(col_means[left_third_idx:right_third_idx]) if left_third_idx < right_third_idx else 128
        
        left_drop = center_mean - left_min_col
        right_drop = center_mean - right_min_col
        
        col_diffs = np.abs(np.diff(col_means))
        left_max_grad = np.max(col_diffs[:left_third_idx]) if left_third_idx > 1 else 0
        right_max_grad = np.max(col_diffs[right_third_idx - 1:]) if right_third_idx < img_w else 0
        
        is_flanked_by_bezels = (left_drop > 28 and right_drop > 28) or (left_max_grad > 16 and right_max_grad > 16)
        if is_flanked_by_bezels:
            return {
                "is_live": False,
                "is_spoof": True,
                "liveness_score": 10.0,
                "reason": "Mobile Device Screen / Frame Detected. Photos displayed on screens are strictly prohibited."
            }

        # 3. Advanced Multi-Factor Texture & Screen Moiré Pattern Analysis
        # Check A: Specular Glass Reflection (High saturation white hot-spots from phone screens)
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        saturated_pixels = np.sum((face_crop[:, :, 0] >= 238) & 
                                  (face_crop[:, :, 1] >= 238) & 
                                  (face_crop[:, :, 2] >= 238))
        glare_ratio = saturated_pixels / (w * h)
        
        # Check B: Frequency Domain Analysis (Moiré pattern FFT / high-frequency pixel grid of LCD/OLED screens)
        f_transform = np.fft.fft2(gray)
        f_shift = np.fft.fftshift(f_transform)
        magnitude_spectrum = 20 * np.log(np.abs(f_shift) + 1e-6)
        
        # High frequency content at borders of spectrum
        center_h, center_w = magnitude_spectrum.shape[0] // 2, magnitude_spectrum.shape[1] // 2
        radius = min(center_h, center_w) // 3
        
        # Mask out center (low frequencies)
        y_grid, x_grid = np.ogrid[:magnitude_spectrum.shape[0], :magnitude_spectrum.shape[1]]
        mask = (x_grid - center_w)**2 + (y_grid - center_h)**2 > radius**2
        high_freq_energy = np.mean(magnitude_spectrum[mask])
        
        # Check C: Laplacian Sharpness (Screens have artificial edges or unnatural flat blur)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Check D: Color Distribution & Chrominance Variance (YCbCr)
        ycbcr = cv2.cvtColor(face_crop, cv2.COLOR_BGR2YCrCb)
        cb_std = np.std(ycbcr[:, :, 1])
        cr_std = np.std(ycbcr[:, :, 2])
        chroma_variance = (cb_std + cr_std) / 2.0
        
        # 4. Decision Matrix
        is_spoof = False
        spoof_reason = ""
        liveness_score = 95.0
        
        # Glare test (Phone screen reflection)
        if glare_ratio > 0.020:
            is_spoof = True
            spoof_reason = "Mobile Screen Glare / Display Reflection Detected."
            liveness_score = 15.0
            
        # High frequency Moiré grid test (Digital display pixel lattice)
        elif high_freq_energy > 155.0:
            is_spoof = True
            spoof_reason = "Digital Display / Screen Grid Pattern Detected."
            liveness_score = 20.0
            
        # Unnatural Chroma Variance (Printed photo or re-photographed screen)
        elif chroma_variance < 4.0:
            is_spoof = True
            spoof_reason = "Printed Photo / Low-Color Spoof Detected."
            liveness_score = 25.0
            
        # Extreme Blur / Completely Unreadable
        elif laplacian_var < 2.0:
            is_spoof = True
            spoof_reason = "Camera frame is too blurry or out of focus."
            liveness_score = 30.0
            
        # 4. If MiniFASNet ONNX is loaded, run neural inference
        if self.session is not None and not is_spoof:
            try:
                # MiniFASNet expects (1, 3, 80, 80) normalized float32
                resized = cv2.resize(face_crop, (80, 80))
                rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
                transposed = np.transpose(rgb, (2, 0, 1)).astype(np.float32)
                # Normalize (mean 127.5, std 128.0)
                tensor = (transposed - 127.5) / 128.0
                tensor = np.expand_dims(tensor, axis=0)
                
                input_name = self.session.get_inputs()[0].name
                outputs = self.session.run(None, {input_name: tensor})
                
                # Output probabilities: [spoof_score, live_score]
                logits = outputs[0][0]
                exp_logits = np.exp(logits - np.max(logits))
                probs = exp_logits / np.sum(exp_logits)
                
                live_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
                liveness_score = round(live_prob * 100.0, 1)
                
                if live_prob < settings.SPOOF_CONFIDENCE_THRESHOLD:
                    is_spoof = True
                    spoof_reason = "Neural Anti-Spoof: Digital Screen or Photo Replay Detected."
            except Exception as e:
                print(f"MiniFASNet inference error: {e}")

        return {
            "is_live": not is_spoof,
            "is_spoof": is_spoof,
            "liveness_score": liveness_score,
            "reason": spoof_reason if is_spoof else "Living human verified."
        }

anti_spoof_engine = AntiSpoofEngine()
