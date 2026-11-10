"""
HOSTELEAZE Desktop App — Single-File One-Click Installer Builder
Builds dist/HostelEaze-Setup.exe (single self-contained executable)
"""

import os
import sys
import subprocess

def build_single():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    icon_path = os.path.join(base_dir, "assets", "icon.ico")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "--name=HostelEaze-Setup",
        f"--icon={icon_path}",
        "--collect-all=webview",
        "--collect-all=clr_loader",
        "--collect-all=pythonnet",
        f"--add-data={os.path.join(base_dir, 'config.py')};.",
        f"--add-data={os.path.join(base_dir, 'assets')};assets",
        "--hidden-import=webview",
        "--hidden-import=clr",
        "--hidden-import=clr_loader",
        "--hidden-import=pythonnet",
        "--hidden-import=requests",
        os.path.join(base_dir, "main.py")
    ]

    print("=" * 60)
    print("Building single-file HostelEaze-Setup.exe...")
    print("=" * 60)
    print("Command:", " ".join(cmd))
    print()

    res = subprocess.run(cmd, cwd=base_dir)
    if res.returncode == 0:
        exe_path = os.path.join(dist_dir, "HostelEaze-Setup.exe")
        print("\n" + "=" * 60)
        print("ONE-CLICK INSTALLER BUILD SUCCESSFUL!")
        print("File location:", exe_path)
        if os.path.exists(exe_path):
            print(f"File size: {os.path.getsize(exe_path) / (1024*1024):.2f} MB")
        print("=" * 60)
        return exe_path
    else:
        print("\n" + "=" * 60)
        print("BUILD FAILED!")
        print("=" * 60)
        return None

if __name__ == "__main__":
    build_single()
