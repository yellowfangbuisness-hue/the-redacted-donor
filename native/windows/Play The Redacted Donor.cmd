@echo off
rem The Redacted Donor for Windows.
rem Opens the game in its own window with Microsoft Edge (part of Windows 10 and 11), or Google Chrome if Edge is
rem missing. Nothing is installed. Keep this file in the same folder as index.html.
setlocal EnableDelayedExpansion
title The Redacted Donor
set "GAME=%~dp0index.html"
if not exist "%GAME%" goto missing

rem A file address the browser understands: forward slashes, and %%20 for spaces.
set "URL=file:///%GAME:\=/%"
set "URL=!URL: =%%20!"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" goto edge
if exist "%CHROME%" goto chrome
rem Neither was found: open the game in whatever browser is the default.
start "" "%GAME%"
exit /b 0

:edge
start "" "%EDGE%" --app="%URL%" --window-size=1440,900
exit /b 0

:chrome
start "" "%CHROME%" --app="%URL%" --window-size=1440,900
exit /b 0

:missing
echo index.html was not found next to this file.
echo Extract the whole folder from the zip first, then run this file again.
pause
exit /b 1
