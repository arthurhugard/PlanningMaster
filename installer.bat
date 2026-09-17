@echo off
setlocal
cd /d "%~dp0"

rem ---------------------------------------------------------------
rem  PlanningMaster - installation, une seule fois.
rem  Relie ce dossier au depot GitHub.
rem ---------------------------------------------------------------

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Git n'est pas installe. Lance :
  echo       winget install --id Git.Git -e
  echo   puis rouvre un terminal et relance ce script.
  echo.
  pause
  exit /b 1
)

echo.
set "REPO=planningmaster"
set /p "REPO=  Nom du depot GitHub [%REPO%] : "
if "%REPO%"=="" set "REPO=planningmaster"

set "URL=https://github.com/arthurhugard/%REPO%.git"
echo.
echo   Depot distant : %URL%
echo.

if not exist ".git" (
  git init -b main
  if errorlevel 1 ( pause & exit /b 1 )
)

git remote remove origin >nul 2>nul
git remote add origin "%URL%"

git config user.name  >nul 2>nul || git config user.name "Arthur Hugard"
git config user.email >nul 2>nul || git config user.email "arthurhugardpro@gmail.com"

git add -A
git commit -m "PlanningMaster" 2>nul

echo.
echo   Recuperation de ce qui est deja en ligne...
git fetch origin main 2>nul
if not errorlevel 1 (
  git branch --set-upstream-to=origin/main main 2>nul
  git pull --rebase origin main
  if errorlevel 1 (
    echo.
    echo   Conflit entre le contenu en ligne et le dossier local.
    echo   Pour ecraser la version en ligne par celle-ci :
    echo       git push --force-with-lease -u origin main
    echo.
    pause
    exit /b 1
  )
)

git push -u origin main
if errorlevel 1 (
  echo.
  echo   Le push a echoue. Une fenetre de connexion GitHub a pu
  echo   s'ouvrir : valide-la, puis relance ce script.
  echo.
  pause
  exit /b 1
)

echo.
echo   C'est relie. Desormais : publier.bat a chaque mise a jour.
echo.
pause
