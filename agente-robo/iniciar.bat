@echo off
rem Liga o agente do robô (Windows). Deixe esta janela aberta enquanto a clínica usa o robô.
cd /d "%~dp0"
if not exist .venv (
  echo Primeira execucao: instalando...
  python -m venv .venv || (echo Instale o Python 3 em python.org & pause & exit /b 1)
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt && playwright install chromium
) else (
  call .venv\Scripts\activate.bat
)
if not exist .env (echo Falta o arquivo .env - copie env.exemplo para .env e preencha. & pause & exit /b 1)
python agente.py
pause
