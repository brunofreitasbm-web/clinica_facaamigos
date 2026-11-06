#!/usr/bin/env python3
"""
Gera o token de um agente novo. Mostra:
  1) o token, que vai no .env do agente (AGENT_TOKEN=...);
  2) o SQL para cadastrar o agente no Supabase (só o hash é guardado no banco).
Uso: python3 gerar_token.py "Computador da recepção" [clinic_id]
"""
import hashlib
import secrets
import sys

nome = sys.argv[1] if len(sys.argv) > 1 else "Computador da recepção"
clinica = sys.argv[2] if len(sys.argv) > 2 else "c0000000-0000-0000-0000-000000000001"
token = secrets.token_urlsafe(40)
hash_ = hashlib.sha256(token.encode()).hexdigest()
nome_sql = nome.replace("'", "''")
print("\n1) No .env do agente:\n")
print(f"AGENT_TOKEN={token}")
print("\n2) No SQL Editor do Supabase:\n")
print(f"insert into portal_robot_agents (clinic_id, name, token_hash)\nvalues ('{clinica}', '{nome_sql}', '{hash_}');\n")
print("Guarde o token só no .env. Para revogar: update portal_robot_agents set active = false where name = '...';\n")
