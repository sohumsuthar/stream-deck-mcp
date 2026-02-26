@echo off
curl -s --max-time 5 -X POST http://127.0.0.1:9090/clip >nul 2>&1
