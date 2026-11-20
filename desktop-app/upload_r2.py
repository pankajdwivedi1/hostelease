import os
import sys
import boto3
from botocore.config import Config

R2_ENDPOINT = "https://a9ae2d32d680701b543584167b43aa44.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID = "1c9011d11cb2cd98d9fdd7834da38324"
R2_SECRET_ACCESS_KEY = "b359c3fc5b0bf1d23027286e1a6726d48d3752f4cdf7ea1e66096e22f7c68ff0"
BUCKET_NAME = "hosteleaze-student-photos"
KEY = "downloads/HostelEaze-Setup.exe"

file_path = os.path.join(os.path.dirname(__file__), "dist", "HostelEaze-Setup.exe")
total_bytes = os.path.getsize(file_path)
print(f"File: {file_path} ({total_bytes / (1024*1024):.2f} MB)")

uploaded_bytes = 0
def progress_cb(chunk):
    global uploaded_bytes
    uploaded_bytes += chunk
    pct = (uploaded_bytes / total_bytes) * 100
    print(f"\rProgress: {uploaded_bytes / (1024*1024):.2f}/{total_bytes / (1024*1024):.2f} MB ({pct:.1f}%)", end="", flush=True)

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
)

print("Starting upload to R2...")
s3.upload_file(
    file_path,
    BUCKET_NAME,
    KEY,
    ExtraArgs={"ContentType": "application/vnd.microsoft.portable-executable"},
    Callback=progress_cb
)
print("\nUpload COMPLETE!")
