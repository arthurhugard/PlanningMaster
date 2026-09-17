@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem  Le pause ne sert qu'au double-clic : en terminal il avale la
rem  premiere lettre de la commande suivante.
set "DBLCLICK=0"
echo %cmdcmdline% | find /i "%~nx0" >nul 2>&1 && set "DBLCLICK=1"

rem  PlanningMaster - installation, une seule fois.

where git >nul 2>&1
if errorlevel 1 goto nogit

set "REPO=planningmaster"
echo.
set /p "REPO=  Nom du depot GitHub [planningmaster] : "
if "%REPO%"=="" set "REPO=planningmaster"
set "URL=https://github.com/arthurhugard/%REPO%.git"

echo.
echo   Depot distant : %URL%
echo.

if exist ".git" goto hasgit
git init -b main
if errorlevel 1 goto fail
:hasgit

git remote remove origin >nul 2>&1
git remote add origin "%URL%"
if errorlevel 1 goto fail

git config user.name "Arthur Hugard"
git config user.email "arthurhugardpro@gmail.com"
git config core.autocrlf false

git add -A
git commit -m "PlanningMaster" >nul 2>&1

echo   Recuperation de ce qui est deja en ligne...
git fetch origin main
if errorlevel 1 goto firstpush

git pull --rebase origin main
if errorlevel 1 goto conflit

:firstpush
git push -u origin main
if errorlevel 1 goto pushfail

echo.
echo   C'est relie. Desormais : publier.bat a chaque mise a jour.
echo.
call :hold
exit /b 0

:conflit
echo.
echo   Le contenu en ligne et le dossier local divergent.
echo   Ton dossier local est la version la plus recente, donc pour
echo   ecraser ce qui est en ligne, colle :
echo.
echo       git rebase --abort
echo       git push --force-with-lease -u origin main
echo.
call :hold
exit /b 1

:pushfail
echo.
echo   Le push a echoue. Une fenetre de connexion GitHub a pu
echo   s'ouvrir : valide-la, puis relance ce script.
echo.
call :hold
exit /b 1

:nogit
echo.
echo   Git n'est pas installe. Colle :
echo       winget install --id Git.Git -e
echo   puis ferme et rouvre ce terminal.
echo.
call :hold
exit /b 1

:fail
echo.
echo   Echec. Lis le message ci-dessus.
echo.
call :hold
exit /b 1

:hold
if "%DBLCLICK%"=="1" pause
exit /b 0
