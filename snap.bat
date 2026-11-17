@echo off
rem Double-click to save the shop as picture(s) in the "screenshots" folder.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0snap.ps1" %*
pause
