# Atlas de mercados e comparação cambial

Atualização local de 17/11/2026 do Observatório Econômico Global. Repositório em `F:\Observatorio_Economico_Global`, Windows 11, Python 3.13, JavaScript e cartografia vetorial SVG. Na pasta do projeto, `.\scripts\start.ps1` inicia o serviço em http://127.0.0.1:8842/ e `.\scripts\stop.ps1` encerra a instância. A etiqueta Git local `atlas-cambio-v2` identifica esta entrega.

## Identidade e uso

Uma cópia isolada dos estilos e da página do CryptoLab V2, revisão `c272a9aef44ab5e7adc57b4c053191e090f6b347`, serviu de referência. O CSS carregado naquela página especifica grafite #111417, âmbar #d7a24a, títulos serifados e janelas de raio curto. O Observatório adota uma superfície amarela maior, símbolo cartográfico próprio e barras de título com bordas pretas. A data no cabeçalho identifica a última observação disponível. No celular o mapa, a ficha e o comparador se empilham. As imagens da versão inicial continuam em sua pasta histórica.

## Instrumentos e método

- **Ficha do mercado.** USD/BRL e os demais cruzamentos em moeda local por USD usam séries da mesma captura e data do BCE. O cálculo é (moeda local por EUR) / (USD por EUR). Para EUR, a taxa é o inverso de EUR/USD. São apresentados cinco decimais e as entradas constam em Origem e método. Para USD, não se publica um cruzamento contra si mesmo.
- **Comparador.** Duas séries EUR/moeda recebem base 100 na primeira data comum dentro da janela selecionada. A API calcula os níveis e as variações acumuladas. A janela termina na data mais recente entre os dois pares, e o gráfico só usa datas existentes em ambos. O painel exibe período efetivo, número de datas, variações, estado da fonte e tabela acessível. Uma alta significa mais unidades da moeda compradas por um euro.
- **API.** GET /api/atlas acrescenta usd_crosses ao contrato existente. GET /api/comparacao?a=BRL&b=USD&dias=30 lê a mesma fonte e cache e inclui o SHA-256, o horário de coleta e os pares. Duas observações comuns são o mínimo. A seleção duplicada ou insuficiente produz mensagem e série vazia.
- **Fonte e direitos.** Esta entrega usa a mesma integração diária e as mesmas permissões de reprodução do BCE. A identificação dos cálculos próprios consta nos painéis. Endpoint oficial, política de uso e intervalo de coleta de quatro horas estão na [matriz de fontes](fontes.md).

## Verificação

Foram aprovados 19 testes de backend, incluindo seis para os cruzamentos e a comparação temporal. O roteiro de navegador validou desktop e celular, temas, zoom, mudança de mercado, troca dos pares e da janela, recarga e perda simulada dos dados. As requisições do navegador ficaram no endereço local. Na verificação de 17/11/2026, EUR/BRL de 6,3539 e EUR/USD de 1,0989 resultaram em USD/BRL de 5,78205. Fonte BCE, coleta às 22:03:58 BRT.

## Próximas melhorias sugeridas

1. **Juros e inflação no mapa.** Começar pela ficha do Brasil com a meta Selic e o IPCA em 12 meses. Verificar permissão por série e guardar vigência, mês de referência e data de publicação, para que o analista saiba a que momento cada número pertence.
2. **Comparar bolsas em moeda local e em USD.** Priorizar Ibovespa e S&P 500 depois de confirmar direitos de exibição para o público do produto. Alinhar sessões e identificar retorno de preço ou total antes de habilitar a comparação.
3. **Exportar uma comparação com sua origem.** Oferecer CSV com período efetivo, unidades, séries e método de normalização, após verificar os avisos exigidos para o arquivo exportado.

[Panorama](evidencias/atlas-cambio/panorama.png) · [Comparador](evidencias/atlas-cambio/comparador.png) · [Tema claro](evidencias/atlas-cambio/europa.png) · [Celular](evidencias/atlas-cambio/mobile.png)
