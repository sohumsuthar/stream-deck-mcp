@echo off
:: Ensure main server is running (it auto-starts mic service + camera buffer)
curl -s --max-time 1 http://localhost:7891/health >nul 2>&1
if %errorlevel% neq 0 (
    start "" /B node "P:\sohum\stream-deck-mcp\build\server.js" >nul 2>&1
    :waitserver
    ping -n 2 127.0.0.1 >nul
    curl -s --max-time 1 http://localhost:7891/health >nul 2>&1
    if %errorlevel% neq 0 goto waitserver
)
:: Ensure mic service is up (server starts it, but wait for it)
:waitmic
curl -s --max-time 1 http://localhost:9090/status >nul 2>&1
if %errorlevel% neq 0 (
    ping -n 2 127.0.0.1 >nul
    goto waitmic
)
:: Clip all sources
curl -s -X POST http://localhost:9090/clip >nul 2>&1
