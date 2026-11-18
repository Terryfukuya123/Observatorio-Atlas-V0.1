# Camada macro · BCB e Banco Mundial

Revisão de 17/11/2026. Primeira etapa da ampliação de conteúdo para validação do produto: só fontes oficiais, gratuitas e com licença que permite exibição a terceiros e uso comercial futuro.

## O que entra

- **Brasil (SGS/BCB, ODbL):** Selic meta e efetiva, IPCA no mês e em 12 meses, IGP-M, IBC-Br, PIB mensal e anual, dívida bruta e líquida, reservas internacionais, saldo de crédito e inadimplência.
- **Câmbio oficial brasileiro (PTAX/BCB, ODbL):** USD/BRL e EUR/BRL, venda do boletim de fechamento.
- **Mundo (WDI/Banco Mundial, CC BY 4.0):** crescimento e nível do PIB, PIB per capita, inflação, desemprego, dívida do governo central, conta corrente, comércio e população. Cobertura de 109 a 212 territórios do mapa, conforme o indicador. Cada valor traz o ano da observação.

O catálogo fica em `config/macro.json`. Incluir uma série do SGS ou um indicador do WDI é editar esse arquivo: o serviço, a API e os testes de catálogo já tratam a nova entrada.

## Como funciona

`server/macro.py` mantém uma entrada de cache por série em `data/cache/macro.json`, com resumo SHA-256 da resposta, recepção, tentativas, latência e próxima coleta (4h para o BCB, 24h para o Banco Mundial, 30 min após falha). A requisição HTTP nunca espera a rede: a coleta roda em segundo plano e a página recebe a última versão válida. Falhas preservam o último dado com estado **Dado histórico**. As datas do BCB são tratadas no fuso de Brasília, e a vigência futura da meta Selic é descartada.

## API

| Rota | Conteúdo |
|---|---|
| `/api/macro` | Séries do Brasil com último valor, anterior e histórico; PTAX; resumo de cobertura dos indicadores globais |
| `/api/macro/indicador?id=inflacao` | Valor por território (ISO3) para colorir o mapa |
| `/api/macro/pais?iso=BRA` | Todos os indicadores globais de um país, com a referência Mundo |

Cada resposta identifica fonte, licença, conjunto de dados e estado da coleta.

## Pendências

- Integração visual (painel Brasil, ficha macro do país e mapa coroplético) após a entrega do heatmap, para evitar conflito em `web/app.js` e `web/index.html`.
- Próximos candidatos gratuitos: expectativas Focus (BCB/Olinda), IBGE/SIDRA, Tesouro dos EUA (curva de juros, domínio público), Eurostat e OCDE (CC BY 4.0), FMI.
- Descartados nesta revisão: SGS 24369 (desocupação) sem resposta, e juros reais do WDI (FR.INR.RINR), com valor inconsistente para o Brasil.
