@echo off
setlocal
cd /d "%~dp0"

rem  PlanningMaster - publication.

where git >nul 2>&1
if errorlevel 1 goto nogit
if not exist ".git" goto noinit

git diff --quiet
if errorlevel 1 goto haschanges
git diff --cached --quiet
if errorlevel 1 goto haschanges
git ls-files --others --exclude-standard >"%TEMP%\pm_new.txt"
for %%A in ("%TEMP%\pm_new.txt") do if %%~zA GTR 0 goto haschanges
del "%TEMP%\pm_new.txt" >nul 2>&1
echo.
echo   Rien n'a change depuis le dernier envoi.
echo.
pause
exit /b 0

:haschanges
del "%TEMP%\pm_new.txt" >nul 2>&1
rem  le moteur est partage avec l'Edge Function : on resynchronise
if not exist "supabase\functions\_shared" mkdir "supabase\functions\_shared"
copy /Y game-core.js "supabase\functions\_shared\game-core.js" >nul
echo.
echo   Fichiers modifies :
git --no-pager status --short
echo.

set "MSG=%*"
if not "%MSG%"=="" goto gotmsg
set /p "MSG=  Message (Entree pour 'Mise a jour') : "
if "%MSG%"=="" set "MSG=Mise a jour"
:gotmsg

git add -A
git commit -m "%MSG%"
if errorlevel 1 goto commitfail

git push
if errorlevel 1 goto pushfail

echo.
echo   Envoye. Vercel redeploie dans la minute.
echo.
pause
exit /b 0

:commitfail
echo.
echo   Le commit a echoue.
echo.
pause
exit /b 1

:pushfail
echo.
echo   Le push a echoue. Si une fenetre de connexion GitHub s'ouvre,
echo   valide-la puis relance.
echo.
pause
exit /b 1

:noinit
echo.
echo   Ce dossier n'est pas encore relie. Lance installer.bat.
echo.
pause
exit /b 1

:nogit
echo.
echo   Git n'est pas installe. Colle :
echo       winget install --id Git.Git -e
echo.
pause
exit /b 1
