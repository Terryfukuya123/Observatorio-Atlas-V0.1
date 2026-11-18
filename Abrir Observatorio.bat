@echo off
rem Atalho de dois cliques do Observatório Econômico Global (Windows).
rem Procura o Python 3.11 ou mais novo, inicia a plataforma e abre o navegador.
chcp 65001 >nul
title Observatório Econômico Global
cd /d "%~dp0"

set "PY="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul && set "PY=python"
if not defined PY goto sem_python

echo.
echo  Observatório Econômico Global
echo  -----------------------------
echo  Iniciando... o navegador vai abrir sozinho.
echo.
%PY% observatorio.py --abrir
echo.
echo  A plataforma foi encerrada.
pause
exit /b

:sem_python
echo.
echo  Para usar o Observatório, instale o Python (versão 3.11 ou mais nova).
echo.
echo  1. A página de download vai abrir agora: clique em "Download Python".
echo  2. Na primeira tela da instalação, marque "Add python.exe to PATH".
echo  3. Depois de instalar, dê dois cliques de novo em "Abrir Observatorio".
echo.
start "" "https://www.python.org/downloads/"
pause
