#!/bin/bash
# Liga o agente do robô (Linux). Deixe esta janela aberta enquanto a clínica usa o robô.
cd "$(dirname "$(readlink -f "$0")")"
if [ ! -d ".venv" ]; then
    echo "Primeira execução: instalando..."
    python3 -m venv .venv || { echo "Instale o venv: sudo apt install python3-venv"; read -p "Enter"; exit 1; }
    source .venv/bin/activate
    pip install -r requirements.txt && playwright install chromium
else
    source .venv/bin/activate
fi
[ -f .env ] || { echo "Falta o arquivo .env (copie env.exemplo para .env e preencha)."; read -p "Enter"; exit 1; }
python agente.py
read -p "Agente parado. Enter para fechar."
