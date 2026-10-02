@echo off
setlocal
cd /d %~dp0
if exist backend\runtime\apartcare_state.json del /q backend\runtime\apartcare_state.json
if exist backend\runtime\uploads rmdir /s /q backend\runtime\uploads
if not exist backend\runtime mkdir backend\runtime
echo Clean development state reset.
echo The next backend start will show the Platform Owner setup screen again.
pause
