"""
Model Downloader Utility for Hostelease AI Microservice
Downloads standard ArcFace and MiniFASNet ONNX model files.
"""

import os
import urllib.request
from app.config import settings

MODELS = {
    settings.ARCFACE_MODEL_FILENAME: "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx",
    settings.ANTISPOOF_MODEL_FILENAME: "https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/raw/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.onnx"
}

def ensure_models_directory():
    os.makedirs(settings.MODELS_DIR, exist_ok=True)

def download_file(url: str, destination: str):
    print(f"📥 Downloading model from {url}...")
    try:
        urllib.request.urlretrieve(url, destination)
        print(f"✅ Saved model to {destination}")
    except Exception as e:
        print(f"⚠️ Could not download {destination}: {e}")

def check_and_download_all():
    ensure_models_directory()
    for filename, url in MODELS.items():
        dest = os.path.join(settings.MODELS_DIR, filename)
        if not os.path.exists(dest):
            download_file(url, dest)
        else:
            print(f"✓ Model {filename} already exists.")

if __name__ == "__main__":
    check_and_download_all()
