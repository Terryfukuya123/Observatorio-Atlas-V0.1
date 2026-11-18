# Contrato de dados da primeira entrega

**GET /api/atlas** retorna `markets` (cadastro), `series` (observações por moeda de cotação), `source` (saúde e proveniência), `endpoint` (origem oficial) e `expected` (dia TARGET esperado à hora da requisição). A associação de país a série é explícita. Alemanha, França e Zona do Euro compartilham a referência EUR/USD. A série não representa o desempenho de bolsa ou da economia local.

| Campo da série | Semântica |
|---|---|
| instrument, currency, unit | EUR/XXX, moeda de cotação, unidades de XXX por EUR |
| value | String decimal da observação mais recente, preserva a precisão da fonte |
| source, market, method, rights | BCE, referência do Eurosistema, método cambial e autorização ECB-REF da matriz |
| observed, observation_time | Data ISO da observação. Hora individual ausente e representada por null |
| received | Instante ISO UTC em que o servidor recebeu a captura válida. A interface usa Brasília |
| frequency, session | Diária TARGET. A sessão de negociação não se aplica a esta referência |
| status | Atualizado, Atrasado ou Dado histórico, calculado no backend |
| history | Pares ordenados [data ISO, valor decimal], mesma unidade, fonte, método, captura e periodicidade |
| change | Objeto com base, fim e variação em porcentagem para o par; null indica referência insuficiente |

O frontend apenas formata valores, filtra os dias exibidos e projeta coordenadas no gráfico. A API trata o valor `null` como ausência. Os índices de bolsa do catálogo são identificadores. Sua exibição de preços depende de licença e de calendário de sessão do respectivo mercado.

## Validade e falhas

A publicação usual é em torno das 16h na Europa Central. Por política operacional, a última referência devida muda às 17h UTC em dias TARGET. Sábados, domingos, 1º de janeiro, Sexta-Feira Santa, segunda-feira de Páscoa, 1º de maio, 25 e 26 de dezembro não avançam a expectativa. O dia anterior à publicação permanece válido nesse intervalo. Esse calendário serve à referência do BCE. Ver [dias de fechamento do TARGET](https://www.ecb.europa.eu/home/contacts/working-hours/html/index.en.html).

- **Atualizado** identifica uma referência diária que alcança a última publicação esperada.
- **Atrasado** identifica uma série cuja última observação é anterior à esperada, mesmo quando a transferência teve sucesso.
- **Fonte indisponível** registra erro de rede ou validação. Uma última captura válida ainda retida recebe **Dado histórico**. Sem captura válida, os valores ficam ausentes.
- **Cobertura parcial** indica que o arquivo trouxe somente parte das moedas acompanhadas. Séries sem observação não recebem um número. Uma série ausente tampouco herda valor de outra moeda.
- **Sem cobertura** identifica instrumento ou território sem série integrada. **Uso não autorizado** identifica cotação de índice sem autorização de exibição confirmada neste produto.
- **Mercado fechado** é reservado a instrumentos com sessão e calendário de negociação verificados. Nesta versão o estado da sessão das bolsas é **Não verificada**.

## Coleta e persistência

Há uma autoridade, um endpoint e uma coleta por janela compartilhada entre as páginas. Cada tela aberta consulta a API local a cada 5 min. A primeira leitura após 4h dispara atualização do BCE. Em falha o servidor espera pelo menos 30 min e respeita Retry-After quando presente. Reabrir página ou alternar país utiliza a mesma captura. A latência e os contadores de tentativas e sucessos ficam no registro da fonte.

O cache guarda o XML de até 512.000 bytes e metadados em um único arquivo. O envelope tem limite de leitura de 720.000 bytes, com um único temporário durante substituição atômica. O SHA-256 identifica o conteúdo. O arquivo oficial já traz uma janela curta; a API limita o histórico aos últimos 90 dias em relação à data mais recente da fonte, incluindo o dia de corte. O cache recupera a captura verificada no reinício. Um hash inválido ou XML malformado impede o uso do conteúdo. Uma data que regrida numa série presente nas duas capturas rejeita a substituição. Após sete dias sem coleta válida, a primeira leitura da API descarta o conteúdo cambial expirado. Com o serviço desligado não há processo de limpeza em segundo plano.

A cartografia tem versão fixa e permanece disponível offline. O catálogo é versionado no Git. Não há arquivo por observação ou por visitante. A retenção das evidências de entrega é manual e independente do cache.

## Cálculos

A variação exibida é do **preço do par cambial**, calculada no backend como 100 × (final / inicial − 1). Exige o dia TARGET imediatamente anterior. Na falta dele, `change` vale null. Fonte e datas-base constam no registro. A janela de 7/30/90 dias controla o gráfico, sem alterar o significado da variação diária dos cartões.

O núcleo aritmético também dispõe de preço local e conversão em USD: (final / inicial) × (câmbio inicial / câmbio final) − 1, quando o câmbio está em moeda local por USD. Para MTD e YTD, a referência teórica é o último dia do mês/ano anterior. Em 12M, usa-se a data de um ano antes, com 28 de fevereiro para o aniversário de um dia bissexto. O utilitário localiza a última observação anterior ou igual à referência, com tolerância máxima de sete dias. Adaptadores de índices deverão exigir a sessão correta, calendário comum para câmbio e índice e natureza de preço ou retorno total antes da exibição. Esses retornos de índices ainda não são publicados.
