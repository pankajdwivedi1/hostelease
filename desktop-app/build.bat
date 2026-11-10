@echo off
title Build HostelEaze Gatepass Executable
cd /d "%~dp0"
echo Starting PyInstaller build...
python build_exe.py
pause
