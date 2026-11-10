"""
HOSTELEAZE Desktop Gatepass App
build_exe.py — Packaging script for PyInstaller
"""

import os
import sys
import subprocess
import shutil

def build():
    print("=" * 60)
    print("Building HostelEaze-GatePass.exe...")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    build_dir = os.path.join(base_dir, "build")

    # Command to run PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=HostelEaze-GatePass",
        "--collect-all=webview",
        "--collect-all=clr_loader",
        "--collect-all=pythonnet",
        "--collect-all=customtkinter",
        f"--add-data={os.path.join(base_dir, 'config.py')};.",
        f"--add-data={os.path.join(base_dir, 'core')};core",
        f"--add-data={os.path.join(base_dir, 'ui')};ui",
        f"--add-data={os.path.join(base_dir, 'assets')};assets",
        "--hidden-import=webview",
        "--hidden-import=clr",
        "--hidden-import=clr_loader",
        "--hidden-import=pythonnet",
        "--hidden-import=requests",
        os.path.join(base_dir, "main.py")
    ]

    # Include icon if exists
    icon_path = os.path.join(base_dir, "assets", "icon.ico")
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
        print("BUILD FAILED. See error output above.")
        print("=" * 60)

if __name__ == "__main__":
    build()
