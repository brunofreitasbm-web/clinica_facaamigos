#!/bin/bash
# Instala o plugin TokenEconomizer (Microsoft) nas sessões de nuvem.
# Versão fixada em um commit para não executar código novo sem revisão.
# Para atualizar: troque TE_COMMIT após revisar o diff do upstream.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

TE_REPO="https://github.com/microsoft/TokenEconomizer.git"
TE_COMMIT="46b0a356dc08f01064fa683d9f7d6988dc5deade"
TE_DIR="$HOME/.cache/tokeneconomizer-src"
TE_PLUGIN="tokeneconomizer@tokeneconomizer"

install_te() {
  command -v python3 >/dev/null || { echo "TokenEconomizer: python3 ausente" >&2; return 1; }

  if [ ! -d "$TE_DIR/.git" ]; then
    rm -rf "$TE_DIR"
    git clone --quiet "$TE_REPO" "$TE_DIR"
  fi
  if [ "$(git -C "$TE_DIR" rev-parse HEAD)" != "$TE_COMMIT" ]; then
    git -C "$TE_DIR" fetch --quiet origin
    git -C "$TE_DIR" checkout --quiet "$TE_COMMIT"
  fi

  if ! claude plugin marketplace list 2>/dev/null | grep -q "tokeneconomizer"; then
    claude plugin marketplace add "$TE_DIR"
  fi
  if ! claude plugin list 2>/dev/null | grep -q "$TE_PLUGIN"; then
    claude plugin install "$TE_PLUGIN"
  fi
}

# Plugin é opcional: falha não pode impedir a sessão de iniciar.
install_te || echo "TokenEconomizer: instalação falhou, sessão segue sem o plugin" >&2
exit 0
