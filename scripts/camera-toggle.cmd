@echo off
:: Ensure main server is running (it auto-starts camera buffer + mic service)
curl -s --max-time 1 http://localhost:7891/health >nul 2>&1
if %errorlevel% neq 0 (
    start "" /B node "P:\sohum\stream-deck-mcp\build\server.js" >nul 2>&1
    :wait
    ping -n 2 127.0.0.1 >nul
    curl -s --max-time 1 http://localhost:7891/health >nul 2>&1
    if %errorlevel% neq 0 goto wait
)
:: Clip video (last 90s)
curl -s http://localhost:7891/camera/clip >nul 2>&1
:: Clip audio (last 90s from mic + cam audio)
curl -s -X POST http://localhost:9090/clip >nul 2>&1
