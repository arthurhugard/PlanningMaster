@echo off
setlocal
cd /d "%~dp0"

rem ---------------------------------------------------------------
rem  PlanningMaster - publication
rem  Double-clic, ou "publier" dans le terminal.
rem  Ajoute tout, commit, pousse. Vercel redeploie tout seul.
rem ---------------------------------------------------------------

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Git n'est pas installe ou pas dans le PATH.
  echo   Installe-le avec : winget install --id Git.Git -e
  echo   puis rouvre ce terminal.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo.
  echo   Ce dossier n'est pas encore un depot git.
  echo   Lance d'abord installer.bat une seule fois.
  echo.
  pause
  exit /b 1
)

git diff --quiet && git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo   Rien n'a change depuis le dernier envoi.
  echo.
  pause
  exit /b 0
)

echo.
echo   Fichiers modifies :
git --no-pager status --short
echo.

set "MSG=%*"
if "%MSG%"=="" set /p "MSG=  Message (Entree pour 'Mise a jour') : "
if "%MSG%"=="" set "MSG=Mise a jour"

git add -A
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo   Le commit a echoue.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo   Le push a echoue. Si c'est la premiere fois, une fenetre
  echo   de connexion GitHub a pu s'ouvrir : valide-la et relance.
  echo.
  pause
  exit /b 1
)

echo.
echo   Envoye. Vercel redeploie dans la minute.
echo.
pause
