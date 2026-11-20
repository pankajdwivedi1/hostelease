"""
HOSTELEAZE Desktop Gatepass App
build_exe.py — Packaging script for PyInstaller (Folder Mode --onedir)
100% Native Pure Windows Executable. Zero Browser, Zero WebView2, Zero WebGL.
"""

import os
import sys
import subprocess
import shutil

def build():
    print("=" * 60)
    print("Building 100% Native HostelEaze-GatePass (Folder Mode)...")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    build_dir = os.path.join(base_dir, "build")

    icon_path = os.path.join(base_dir, "assets", "icon.ico")

    # Command to run PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=HostelEaze-GatePass",
        f"--add-data={os.path.join(base_dir, 'config.py')};.",
        f"--add-data={os.path.join(base_dir, 'core')};core",
        f"--add-data={os.path.join(base_dir, 'ui')};ui",
        f"--add-data={os.path.join(base_dir, 'assets')};assets",
        "--collect-all=customtkinter",
        "--collect-all=face_recognition_models",
        "--collect-all=face_recognition",
        "--collect-all=dlib",
        "--collect-all=pyzbar",
        "--collect-all=qrcode",
        "--collect-all=cv2",
        "--hidden-import=customtkinter",
        "--hidden-import=PIL",
        "--hidden-import=PIL.ImageTk",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=cv2",
        "--hidden-import=pyzbar",
        "--hidden-import=qrcode",
        "--hidden-import=face_recognition",
        "--hidden-import=dlib",
        "--hidden-import=numpy",
        "--hidden-import=requests",
        "--hidden-import=sqlite3",
        os.path.join(base_dir, "main.py")
    ]

    if os.path.exists(icon_path):
        cmd.insert(4, f"--icon={icon_path}")

    print("Running command:")
    print(" ".join(cmd))
    print()

    res = subprocess.run(cmd, cwd=base_dir)
    if res.returncode == 0:
        print("\n" + "=" * 60)
        print("BUILD SUCCESSFUL!")
        print(f"Output folder: {os.path.join(dist_dir, 'HostelEaze-GatePass')}")
        print(f"Executable: {os.path.join(dist_dir, 'HostelEaze-GatePass', 'HostelEaze-GatePass.exe')}")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("BUILD FAILED!")
        print("=" * 60)

if __name__ == "__main__":
    build()
