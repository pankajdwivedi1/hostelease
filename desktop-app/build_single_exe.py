"""
HOSTELEAZE Desktop App — Single-File One-Click Installer Builder
Builds dist/HostelEaze-Setup.exe (100% Native 32-bit Universal Windows Executable)
Zero Browser, Zero WebView2, Zero WebGL dependency.
Bundles Microsoft Universal C Runtime (api-ms-win-crt-*.dll & ucrtbase.dll)
so it runs out of the box on raw Windows 7 without needing KB2999226.
"""

import os
import sys
import subprocess

def build_single():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    icon_path = os.path.join(base_dir, "assets", "icon.ico")
    ucrt_dir = os.path.join(base_dir, "ucrt32")

    # Prefer Python 3.8 32-bit for 100% Windows 7/8/10/11 universal compatibility
    win7_py = r"C:\Python38-32\python.exe"
    py_exec = win7_py if os.path.exists(win7_py) else sys.executable

    print(f"Using Python runtime: {py_exec}")

    # Generate icon if missing
    if not os.path.exists(icon_path):
        uvw_src = os.path.join(os.path.dirname(base_dir), "public", "uvw_logo.jpg")
        if os.path.exists(uvw_src):
            try:
                from PIL import Image
                os.makedirs(os.path.dirname(icon_path), exist_ok=True)
                img = Image.open(uvw_src).convert("RGBA")
                icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
                img.save(icon_path, format="ICO", sizes=icon_sizes)
            except Exception as e:
                print("Note on icon generation:", e)

    cmd = [
        py_exec, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "--name=HostelEaze-Setup",
        f"--add-data={os.path.join(base_dir, 'config.py')};.",
        f"--add-data={os.path.join(base_dir, 'core')};core",
        f"--add-data={os.path.join(base_dir, 'ui')};ui",
        f"--add-data={os.path.join(base_dir, 'assets')};assets",
        "--collect-all=customtkinter",
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
        "--hidden-import=numpy",
        "--hidden-import=requests",
        "--hidden-import=sqlite3",
        os.path.join(base_dir, "main.py")
    ]

    # Bundle all 32-bit Universal C Runtime DLLs so Windows 7 never throws "api-ms-win-crt-runtime-l1-1-0.dll is missing"
    if os.path.exists(ucrt_dir):
        for dll in os.listdir(ucrt_dir):
            if dll.lower().endswith(".dll"):
                cmd.append(f"--add-binary={os.path.join(ucrt_dir, dll)};.")

    if os.path.exists(icon_path):
        cmd.insert(4, f"--icon={icon_path}")

    print("=" * 60)
    print("Building 100% Native Universal 32-bit HostelEaze-Setup.exe (with UCRT DLLs)...")
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
