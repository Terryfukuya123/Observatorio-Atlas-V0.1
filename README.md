# Observatório Econômico Global

Aplicação local de consulta geográfica em português. O mapa reúne 242 países e territórios cartografados pelo Natural Earth. Doze mercados prioritários têm fichas configuradas. Nove séries diárias do BCE alimentam o panorama cambial.

## Abrir e encerrar

No PowerShell, com Python 3.11 ou superior no PATH:

```powershell
Set-Location 'F:\Observatorio_Economico_Global'
.\scripts\start.ps1
```

Abra http://127.0.0.1:8842/ no navegador. Para encerrar a instância iniciada pelo script:

```powershell
.\scripts\stop.ps1
```

Também é possível executar **em primeiro plano** com `python observatorio.py` e encerrar com Ctrl+C. A opção `--port` permite outra porta em primeiro plano. Todos os modos escutam em 127.0.0.1. O serviço usa apenas a biblioteca padrão de Python. O navegador recebe código, fonte e cartografia do servidor local. A internet é necessária para renovar o arquivo cambial. A primeira tentativa de coleta pode levar alguns segundos.

[Atlas geográfico, heatmap e informativo](docs/atlas-geografico.md)

## Usar o atlas

- Clique em um território, um marcador, um cartão de câmbio ou um nome na tabela. A ficha indica mercado, par, nível, variação do par, histórico e cobertura.
- Selecione uma região para reenquadrar o mapa e filtrar a lista. Pesquise por **Zona do Euro** para destacar o bloco. A tecla **/** abre a busca. Digite um país, região, moeda, par ou índice. Enter seleciona o primeiro resultado. Tab percorre os resultados, Esc fecha a janela.
- Arraste o mapa ou use a roda do mouse. Com foco no mapa, use as setas, **+**, **−** e **Home**. O botão de enquadramento restaura a região corrente.
- Alterne o intervalo do gráfico entre 7, 30 e 90 dias corridos. A tabela em **Ver origem e metodologia** mostra todas as observações disponíveis. Tema, país, região e intervalo ficam no armazenamento local do navegador, por endereço.
- **Fontes** apresenta saúde, tentativas, latência, datas de coleta e observação, identificador da captura, metodologia e direitos. O indicador de saúde representa a consulta ao BCE. A sessão das bolsas depende de calendário próprio e está identificada como não verificada.

## Câmbio e comparação

Na ficha de um mercado há uma taxa calculada em moeda local por USD quando as referências necessárias têm a mesma data. Em **Origem e método** é possível conferir os pares de entrada. Use **Comparar este par** para levá-lo ao comparador. Escolha o segundo par e uma janela de 7, 30 ou 90 dias. O gráfico coloca ambas as séries em 100 na primeira observação comum. **Dados e método** mostra as datas, os valores normalizados e a captura utilizada.

[Relatório da atualização visual e cambial](docs/atlas-e-cambio.md)

## Estrutura

| Diretório | Responsabilidade |
|---|---|
| web | Página, busca, estilos, gráfico e mapa SVG local |
| config | Catálogo de mercados e vínculo explícito com a série de referência |
| providers | Adaptador para o arquivo oficial do BCE |
| core | Cálculos com Decimal e calendário TARGET |
| server | API HTTP, validade, integridade e cache compartilhado |
| data/cache | Uma captura corrente, metadados e contadores; gravação atômica |
| data/run | Saída local dos scripts de execução |
| scripts | Início, encerramento e utilitário de preparação da cartografia |
| tests | Testes determinísticos e roteiro executável de navegador |
| docs | Matriz de fontes, contrato, licença tipográfica e relatório com capturas |

## Verificar

```powershell
python -m unittest discover -s tests -v
```

Teste opcional da interface com o servidor ativo, Edge instalado e o pacote de desenvolvimento **playwright-core 1.65.1** acessível ao Node.js. Para preparar essa ferramenta numa pasta separada e salvar novas evidências fora das capturas da entrega:

```powershell
npm install --prefix .\data\run\browser --no-audit --no-fund playwright-core@1.65.1
$env:NODE_PATH = (Resolve-Path .\data\run\browser\node_modules).Path
$env:OEG_SCREENSHOTS = Join-Path (Get-Location) 'data/run/capturas'
node tests/browser.cjs
```

O teste de navegador requer pelo menos uma captura válida do BCE e verifica também uma falha simulada isolada na página de teste. O navegador alternativo pode ser definido em `OEG_BROWSER`. A bateria Python é offline.

[Fontes e permissões](docs/fontes.md) · [Contrato de dados](docs/contrato.md) · [Relatório da primeira entrega](docs/entrega-1.md)
