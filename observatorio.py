import sys

# Antes de qualquer import do projeto: com Python antigo, uma mensagem clara em vez de um erro técnico.
if sys.version_info < (3, 11):
    print("O Observatório precisa do Python 3.11 ou mais novo. Este computador tem o "
          f"{sys.version.split()[0]}.\nBaixe a versão atual em https://www.python.org/downloads/ e tente de novo.")
    sys.exit(1)

from server.app import main

if __name__ == "__main__":
    main()
