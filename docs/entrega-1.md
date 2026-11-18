# Primeira entrega · Observatório Econômico Global

**17 de novembro de 2026 · São Paulo.** A aplicação está instalada em `F:\Observatorio_Economico_Global`. Endereço local http://127.0.0.1:8842/. Windows 11 Home 10.0.26300, Python 3.13.5, biblioteca padrão, JavaScript modular, SVG, CSS e fonte DM Sans hospedada localmente. O servidor escuta apenas em 127.0.0.1. O repositório Git usa a branch main. Consulte `git rev-parse HEAD` para a revisão instalada e a etiqueta local `entrega-1` para a versão demonstrada.

## Operação e código

Execute `.\scripts\start.ps1` na pasta do projeto e abra o endereço acima. Para encerrar, execute `.\scripts\stop.ps1`. O README descreve o modo em primeiro plano e os testes. O projeto reúne frontend em web, API em server, adaptador em providers, cálculos em core, catálogo em config, cache em data e testes em tests. A aplicação funciona sem instalação de pacotes Python ou Node, chaves de API ou um servidor de referências.

## Referências examinadas

| Material | Revisão examinada e aplicação |
|---|---|
| CryptoLab V2, main local de F:\CryptoLab_v2 | c272a9aef44ab5e7adc57b4c053191e090f6b347. O remoto não permitiu leitura anônima. Os seis módulos macro, as duas interfaces, o contrato de confiabilidade e auditorias do Macro Radar foram consultados em um arquivo isolado extraído com git archive. O mesmo HEAD foi verificado depois. |
| OpenTerminal | aed097c680cd8ec1c391ae06966babe7d6d91fc6. Clone de referência separado. Analisados registro de provedores, limites e TTL de cache, rotas, conector BCE, workspace e widgets de macro, calor, screener, gráfico e cotação. |
| Natural Earth | v5.1.2, Admin 0 Countries, 1:50m. [GeoJSON original](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson). SHA-256 de entrada 3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb. Geometrias simplificadas e projetadas localmente por scripts/build_map.py. [Domínio público](https://www.naturalearthdata.com/about/terms-of-use/). |
| DM Sans | Arquivo variável do [projeto Google Fonts](https://github.com/google/fonts/tree/main/ofl/dmsans), licença SIL OFL 1.1 em docs/DM-Sans-OFL.txt. |

Do CryptoLab vieram as decisões de separar observação e coleta, compartilhar requisições no servidor e identificar a captura com hash. A auditoria de disco de 05/11 mostrou o custo de gravar um snapshot por atualização visual. O Observatório substitui um único arquivo limitado. Do OpenTerminal vieram as ideias de adaptador, monitoramento de latência e seleção vinculada. O código de aplicação foi escrito para este produto. Fallback entre instrumentos exigirá equivalência de método e direitos. Não houve importação de código das referências ou execução de seus serviços.

## Dados comprovados

A integração inicial consulta o [XML oficial de 90 dias](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml). A captura demonstrada teve observações até 17/11/2026 e foi recebida às 22:03:58 de Brasília. Nove séries, 64 observações cada. EUR/BRL do dia foi **6,3539 BRL por EUR**. A aba de origem preserva data da observação, hora da coleta, unidade, periodicidade e método. O arquivo informa apenas a data da observação individual. A hash da captura foi `6ef5920c11e5adb540e0c58ad81ad7d6f94d6435e4f5df7dc3bcd115ba333e93`.

Fonte econômica aprovada para este uso: referências do BCE para BRL, USD, CAD, GBP, CNY, JPY, INR, HKD e AUD contra o euro. Desempenho percentual é cálculo próprio identificado. A coleta é compartilhada e limitada a uma consulta por janela de quatro horas em condições normais. A [matriz de fontes](fontes.md) registra direitos, acesso, cobertura e decisão para cada candidato. Nasdaq, Yahoo Finance, Stooq, TradingView, CoinGecko, Binance e FRED seguem desabilitados. A página informa que os dados do BCE podem ser obtidos gratuitamente na fonte.

## Interface e verificação

1. No panorama, o Brasil vem selecionado na primeira visita. O painel mostra EUR/BRL, variação contra o dia TARGET anterior, histórico e cobertura das demais camadas.
2. O mapa tem 242 feições com seleção por território, zoom, pan e teclado. A busca por Ibovespa leva ao Brasil. A busca por CAC 40 seleciona a França. O bloco Zona do Euro destaca seus 21 países, conforme a [composição do BCE](https://www.ecb.europa.eu/euro/intro/html/index.en.html).
3. Ao alternar para Europa, a tabela passa a mostrar os quatro mercados europeus configurados. Ao escolher Gana, o painel informa ausência de cobertura. As referências BCE para Alemanha, França e o bloco exibem EUR/USD.
4. As capturas do navegador mostram [panorama escuro](evidencias/panorama.png), [Europa em tema claro](evidencias/europa.png) e [layout móvel](evidencias/mobile.png). Em desktop o painel acompanha o mapa lateralmente. No celular fica abaixo dele, com a tabela rolável na horizontal.
5. O teste de navegador verificou, entre outros pontos, clique real no mapa, movimentação, zoom, busca, bloco, mudança de região, histórico, metadados, persistência após recarga, ausência de overflow a 390 px e resposta a falha simulada da fonte. O navegador não fez pedidos externos durante a jornada e não registrou exceções JS.

## Qualidade e limitações

- **13 testes Python aprovados**. Cobrem normalização, dados inválidos e duplicados, concorrência, cache, falha e recuperação, expiração, regressão temporal, integridade, períodos, conversão em USD, feriados TARGET, catálogo e acesso HTTP limitado.
- **Reinício real aprovado**. Após encerrar e iniciar novamente o processo, o SHA-256, a hora de recebimento e a contagem de consultas ficaram idênticos. Preferências do navegador também sobreviveram à recarga.
- Na inspeção visual, ajustamos o tamanho dos marcadores para que o zoom regional mantenha os rótulos legíveis. Os testes de integridade verificam o descarte de uma captura adulterada e a retenção explícita da última captura válida quando uma atualização falha.
- O Git permanece local. A consulta ao CryptoLab se limitou à leitura de objetos versionados e identificação da revisão. Os logs e os dados privados das referências ficaram fora da análise.
- A cobertura econômica é cambial e diária. Cotações de bolsas, setores, notícias, sessões ao vivo, juros e inflação aguardam fontes e validações específicas. Há testes de aritmética para retornos de preço e em USD. A interface ainda não compara índices nem apresenta retornos YTD de bolsas.

## Próxima entrega

Priorizar um indicador macroeconômico oficial com direitos documentados, periodicidade própria, unidade e política de revisões. Para comparações de índices, selecionar um titular que autorize exibição profissional a analistas externos, identificar preço ou retorno total e alinhar os calendários do índice e do câmbio. Testes com usuários e avaliação comercial completa ficam para a etapa de uso profissional.
