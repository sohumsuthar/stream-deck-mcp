@echo off
echo Creating startup shortcut for Light Control Server...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LightServer.lnk'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c start /min node \"P:\sohum\stream-deck-mcp\build\server.js\"'; $s.WindowStyle = 7; $s.Save()"
echo Done! Server will auto-start on login (minimized).
pause
