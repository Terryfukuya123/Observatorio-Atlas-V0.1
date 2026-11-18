# Atlas em dólar e heatmaps mensais

O acesso abre com USD como base. A leitura de USD/BRL é reais por dólar. O Observatório divide EUR/BRL por EUR/USD em cada data disponível no mesmo arquivo do BCE. O histórico, a comparação e a cor diária usam a série resultante. Se faltar a referência do dia útil TARGET imediatamente anterior, a variação fica indisponível. A opção EUR mostra as taxas originais. Para o território da moeda-base, a ficha apresenta o câmbio bilateral dólar–euro.

## Edição de outubro de 2026

| Vista | Universo acompanhado | Cobertura desta edição |
|---|---|---|
| Cripto | BTC, ETH, BNB, USDT, USDC, RLUSD | 6 de 6, um fundo comparável por token |
| Ações EUA | MSFT, AMZN, V, MA, AMAT, GOOGL, NVDA, NFLX, META | 9 de 9, de 1 a 17 fundos por ação |
| Ações Brasil | PETR4, VALE3, ITUB4, BBDC4, ABEV3, WEGE3, BBAS3, RENT3, SUZB3 | 9 de 9, de 92 a 248 fundos por ação |

São cestas de acompanhamento escolhidas pela presença de posições identificáveis nas duas competências. A cobertura depende da divulgação dos fundos, inclusive dos prazos de confidencialidade. Os códigos fiscais e a listagem estão definidos em `providers/cvm.py`. O heatmap não pretende reproduzir a composição de um índice.

## Como ler um bloco

1. O servidor lê os blocos 4 e 7 dos informes públicos de setembro e outubro. Filtra posições por identificador, tipo de ativo e, para ações dos EUA, bolsa e país. As coincidências com derivativos, ETFs e recibos são descartadas.
2. Para cada fundo e ativo, soma quantidade e valor das posições positivas. Exige pelo menos R$ 100 de posição nos dois meses. Divide o valor declarado em reais pela quantidade para obter uma marcação contábil por unidade.
3. Converte cada marcação à moeda escolhida pela referência do BCE do último dia TARGET até a competência. Nesta edição, as datas cambiais são 30/09 e 30/10. O fechamento contábil de outubro é 31/10.
4. Calcula a variação de cada fundo presente nos dois meses. A cor representa a mediana dessas variações. A ficha exibe a mediana das marcações finais, o intervalo e o número de fundos comparáveis. No mapa setorial, a área padrão representa o valor das posições declaradas no fim do mês. O seletor de área também oferece compras mais vendas quando os dois campos estão disponíveis.
5. Valores refletem critérios de marcação dos declarantes e conversão cambial. Tratam-se de marcações mensais sem ajustes por dividendos ou desdobramentos. Especialmente nos tokens pareados ao dólar, a variação também pode refletir a diferença entre câmbio contábil do fundo e referência do BCE.

## Operação e direitos

O projeto roda em Windows, em `F:\Observatorio_Economico_Global`, com Python, HTML, CSS, JavaScript e SVG locais. O serviço inicia pelo PowerShell com `.\scripts\start.ps1` e serve exclusivamente em `127.0.0.1:8842`. O desenho usa a referência visual do Crypto Lab V2. O processamento dos informes e o componente de heatmap são próprios.

O conjunto CDA é publicado pela CVM sob ODbL 1.0. A base derivada é oferecida sob a mesma licença em `/api/heatmaps`, inclusive as URLs e hashes das origens. As taxas do BCE são gratuitas na origem e os cruzamentos são cálculos do Observatório. [Dados abertos CVM](https://dados.cvm.gov.br/dataset/fi-doc-cda) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) · [Política estatística do BCE](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html).

O acesso à camada mensal dispara uma verificação da competência. A atualização consulta dois ZIPs identificados por AAAAMM e conserva a última edição em caso de atraso, falha, ausência de câmbio ou falta de amostra em uma classe inteira. A publicação é atômica, com uma tentativa por dia quando a edição está vencida. Cada edição tem geração identificada. Revisões posteriores da mesma competência podem ser incorporadas pelo comando no README.

O câmbio usa uma coleta compartilhada com validade de quatro horas. As consultas do navegador permanecem locais. O próximo incremento para acompanhamento de pregão é um feed com autorização de exibição, calendário de negociação e distinção entre sessão aberta e fechamento. [Condições do TradingView](https://www.tradingview.com/policies/) · [Licenças CoinGecko](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses).

## Área, participação e zoom

Os pesos usam a competência final da edição. A posição soma o valor das posições positivas identificadas. O volume soma compras e vendas em reais dos informes selecionados, inclusive negócios cuja posição final ficou zerada. Se uma das pernas vier em branco em qualquer linha do ativo, sua participação em volume fica indisponível. O denominador é a soma dos pesos conhecidos da cesta do mercado escolhido. Focar um setor amplia sua distribuição e preserva o denominador para a leitura da participação na cesta.

Os setores são agrupamentos editoriais do Observatório. Os valores declarados e a amostra de fundos presentes nos dois meses respondem a perguntas diferentes. A ficha identifica as duas medidas e o tamanho da amostra de retorno. A roda amplia no ponto do cursor, o arraste desloca o mapa ampliado e o seletor de ativo localiza posições pequenas ou sem área. No mapa de pregão, os agrupamentos e as métricas são fornecidos diretamente pelo widget.
