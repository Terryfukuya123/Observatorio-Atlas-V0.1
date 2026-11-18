# Camada macro · BCB e Banco Mundial

Revisão de 17/11/2026. Primeira etapa da ampliação de conteúdo para validação do produto: só fontes oficiais, gratuitas e com licença que permite exibição a terceiros e uso comercial futuro.

## O que entra

- **Brasil (SGS/BCB, ODbL):** Selic meta e efetiva, IPCA no mês e em 12 meses, IGP-M, IBC-Br, PIB mensal e anual, dívida bruta e líquida, reservas internacionais, saldo de crédito e inadimplência.
- **Brasil (IBGE/SIDRA):** taxa de desocupação da PNAD Contínua (trimestre móvel), produção industrial, volume do varejo e volume de serviços (variação no mês dessazonalizada e anual), PIB trimestral (contra o trimestre anterior e o mesmo trimestre do ano anterior). Cada valor traz o rótulo do período de referência (por exemplo, "jul–set/2026" ou "2º tri/2026").
- **Câmbio oficial brasileiro (PTAX/BCB, ODbL):** USD/BRL e EUR/BRL, venda do boletim de fechamento.
- **Expectativas de mercado (Focus/BCB, ODbL):** medianas de IPCA, PIB, câmbio, Selic, IGP-M, resultado primário, dívida líquida e conta corrente, do ano corrente até três anos à frente. Cada projeção traz o número de respondentes, o valor de uma e de quatro semanas antes e a sequência de altas ou quedas semanais, como no relatório Focus. Base de cálculo de 30 dias.
- **Curva de juros dos EUA (Tesouro americano, domínio público):** taxas par diárias de 14 vencimentos, de 1 mês a 30 anos. Comparação com 1 semana, 1 mês, início do ano e 1 ano antes, inclinações 10A−2A e 10A−3M com indicação de inversão e histórico desde o início do ano anterior.
- **Europa (Eurostat):** inflação harmonizada (HICP, nova classificação COICOP 2018), desemprego mensal e PIB trimestral (no trimestre e anual) para cerca de 36 países da UE, EFTA e candidatos, além da zona do euro e da UE-27. Valores estimados e provisórios são sinalizados.
- **Economias da OCDE e G20 (OCDE):** inflação ao consumidor, desemprego mensal e indicador antecedente composto (CLI) para até 42 economias, incluindo EUA, Japão, Reino Unido, Brasil, China e Índia, e agregados OCDE, G7 e G20.
- **Mundo (WDI/Banco Mundial, CC BY 4.0):** crescimento e nível do PIB, PIB per capita, inflação, desemprego, dívida do governo central, conta corrente, comércio e população. Cobertura de 109 a 212 territórios do mapa, conforme o indicador. Cada valor traz o ano da observação.

O catálogo fica em `config/macro.json`. Incluir uma série do SGS ou um indicador do WDI é editar esse arquivo: o serviço, a API e os testes de catálogo já tratam a nova entrada.

## Como funciona

`server/macro.py` mantém uma entrada de cache por série em `data/cache/macro.json`, com resumo SHA-256 da resposta, recepção, tentativas, latência e próxima coleta (4h para o BCB e o Tesouro dos EUA, 6h para o IBGE, 12h para Eurostat e OCDE, 7 dias para o ano encerrado da curva, 24h para o Banco Mundial, 30 min após falha). A requisição HTTP nunca espera a rede: a coleta roda em segundo plano e a página recebe a última versão válida. Falhas preservam o último dado com estado **Dado histórico**. As datas do BCB são tratadas no fuso de Brasília, e a vigência futura da meta Selic é descartada.

## Direitos por território

O Eurostat autoriza reuso comercial com citação, **exceto** para dados de países fora da UE, da EFTA e dos candidatos oficiais (por exemplo EUA, Japão, China e Reino Unido). O provider descarta esses territórios na normalização; para eles a fonte é a OCDE, cujos termos permitem uso comercial com citação, ressalvadas restrições de terceiros indicadas nos metadados.

Em 2026 o Eurostat migrou o HICP para a COICOP 2018 (`prc_hicp_minr`). O conjunto antigo (`prc_hicp_manr`) e a inflação da OCDE para países europeus pararam em dez/2025. A ficha do país escolhe a observação mais recente de cada conceito, e qualquer série com último dado acima de 125 dias (mensal) ou 215 dias (trimestral) é marcada como defasada.

## Telas

O módulo `web/macro.js` consome a API e alimenta:

- **Painel Brasil** (`#brasil`): cartões agrupados em Juros e câmbio, Atividade, Inflação, Trabalho e crédito, Fiscal e setor externo. Cada cartão traz último valor, variação contra o anterior, período e minigráfico. Abaixo, a tabela do Focus com as medianas por ano e as sequências semanais de alta ou queda.
- **Juros e ciclo global** (`#juros`): curva do Tesouro dos EUA (hoje, há 1 mês e há 1 ano, eixo em raiz do prazo) com inclinações 10A−2A e 10A−3M, e o CLI da OCDE por território com a fase do ciclo.
- **Mapa · Indicadores**: coroplético em quintis do indicador escolhido, com legenda, cobertura e referência Mundo. A escolha fica salva no navegador.
- **Ficha do país**: dado recente mensal ou trimestral (Eurostat ou OCDE), três anuais-chave do Banco Mundial e o restante recolhido em "Mais indicadores anuais".

Em telas a partir de 851 px a ficha acompanha a altura do mapa e rola por dentro; até 670 px os cartões ficam em 2×2.

## API

| Rota | Conteúdo |
|---|---|
| `/api/macro` | Séries do Brasil (BCB e IBGE) com último valor, anterior e histórico; PTAX; resumo do Focus; vértices-chave da curva dos EUA; resumo de cobertura dos indicadores globais |
| `/api/macro/curva` | Curva do Tesouro dos EUA com comparações, inclinações e histórico de 3M, 2A, 10A, 30A e 10A−2A |
| `/api/macro/focus` | Expectativas Focus com histórico diário das medianas (cerca de 120 dias) |
| `/api/macro/regional?id=eu_inflacao` | Série mensal ou trimestral do Eurostat ou da OCDE por território, com período, situação (estimado/provisório), defasagem e histórico |
| `/api/macro/indicador?id=inflacao` | Valor por território (ISO3) para colorir o mapa |
| `/api/fluxo` | Fluxo de capital no Brasil: acumulado no ano e mesmo período do ano anterior, meses, dias, câmbio por natureza, investimento de não residentes, posição dos bancos, interbancário e atuações do BC |
| `/api/macro/pais?iso=BRA` | Indicadores anuais do Banco Mundial com a referência Mundo e, em `recent`, o dado mensal ou trimestral mais recente por conceito (Eurostat ou OCDE). Aceita também `EMU` (zona do euro) e `EUU` (UE) |

Cada resposta identifica fonte, licença, conjunto de dados e estado da coleta.

## Pendências

- Merge no `main` depois da entrega do heatmap; conflitos esperados em `server/app.py`, `web/app.js`, `web/index.html` e `web/app.css`.
- Próximos candidatos gratuitos: FMI (World Economic Outlook, projeções por país), BIS (juros básicos dos bancos centrais).
- Descartados nesta revisão: SGS 24369 (desocupação) sem resposta, substituída pela tabela 6381 do IBGE, e juros reais do WDI (FR.INR.RINR), com valor inconsistente para o Brasil.
