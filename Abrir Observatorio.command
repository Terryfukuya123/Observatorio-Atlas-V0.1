#!/bin/bash
# Atalho de dois cliques do Observatório Econômico Global (Mac; também roda no Linux pelo terminal).
# Procura o Python 3.11 ou mais novo, inicia a plataforma e abre o navegador.
cd "$(dirname "$0")" || exit 1

ok() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; }

PY=""
for candidate in python3 python3.14 python3.13 python3.12 python3.11 python; do
  if command -v "$candidate" >/dev/null 2>&1 && ok "$candidate"; then PY="$candidate"; break; fi
done

if [ -z "$PY" ]; then
  echo
  echo "  Para usar o Observatório, instale o Python (versão 3.11 ou mais nova)."
  echo
  echo "  1. A página de download vai abrir agora: clique em \"Download Python\"."
  echo "  2. Instale normalmente."
  echo "  3. Depois de instalar, dê dois cliques de novo em \"Abrir Observatorio\"."
  echo
  (open "https://www.python.org/downloads/" || xdg-open "https://www.python.org/downloads/") >/dev/null 2>&1
  read -r -p "  Aperte Enter para fechar."
  exit 1
fi

echo
echo "  Observatório Econômico Global"
echo "  -----------------------------"
echo "  Iniciando... o navegador vai abrir sozinho."
echo
"$PY" observatorio.py --abrir
echo
read -r -p "  A plataforma foi encerrada. Aperte Enter para fechar."
