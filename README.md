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

Também é possível executar **em primeiro plano** com `python observatorio.py` e encerrar com Ctrl+C. A opção `--port` permite outra porta em primeiro plano. Todos os modos escutam em 127.0.0.1. O serviço usa apenas a biblioteca padrão de Python. O navegador recebe código, fonte e cartografia do servidor local. A internet permite renovar o câmbio no BCE e as edições mensais de ativos na CVM. A primeira tentativa de coleta pode levar alguns segundos.

[Atlas geográfico, heatmap e informativo](docs/atlas-geografico.md)

## Espaços de análise

A plataforma se divide em quatro espaços, escolhidos na barra lateral. Cada um abre com uma frase sobre o que responde e tem uma barra fixa com atalhos para as suas partes. No fim, **Continue a análise** leva aos assuntos relacionados:

- **Panorama:** abre com a **manchete do dia**, uma frase com os números que importam (dólar, Selic, IPCA, fluxo e fundos no ano, bolsas abertas). Em seguida vem o **Pulso do dia**: dólar, Selic, IPCA, fluxo cambial, fundos, juros dos EUA, reservas e bolsas abertas, cada número com uma leitura em uma frase e um link para a análise completa. O Pulso vira o **Meu painel**: em **Personalizar** você escolhe entre os destaques e mais de 20 séries do Brasil (atividade, inflação, crédito, emprego, fiscal, PTAX do euro). Nos cartões do Painel Brasil, o alfinete fixa o indicador. A escolha fica salva no navegador, sem conta. Em todos os espaços, o botão **?** ao lado de um indicador ou título abre o glossário **O que é isso?**: o que o número mede e por que ele importa, em duas frases (34 termos, do IBC-Br ao spread 10A−2A). Depois aparece o **Relógio dos pregões**, com as 24 horas do seu dia, a janela de cada bolsa, o almoço das asiáticas e a linha do agora. Por fim, o mapa e a ficha do país.
- **Ao vivo · o que acabou de sair (Panorama):** linha do tempo dos canais oficiais, minutos depois de publicados: notas à imprensa do Banco Central (leilões de swap e outras intervenções no câmbio, Copom), notícias do BC, Agência Brasil (Economia e, filtrada, Política), IBGE, fatos relevantes das companhias na CVM, Fed e BCE. Cada item mostra hora, fonte, tema (câmbio e intervenção, juros e bancos centrais, governo e contas públicas, dados divulgados, regras, empresas, mundo), impacto provável (alto, médio, baixo), um resumo curto, o link para a fonte e o atalho para a análise na plataforma. Há filtros por tema, por período (24 horas ou 7 dias) e "só alto impacto", o destaque do período no topo e a marca **novo** no que chegou desde a última visita. Em todos os espaços, a faixa **Última hora** abaixo do topo mostra o item de alto impacto mais recente das últimas 12 horas. No roteiro do pregão (Bolsas agora), o bloco **Última hora** traz os três itens de peso mais recentes. Opcionalmente, o navegador avisa quando sai algo de alto impacto, com a página aberta.
- **Termômetro de risco · Brasil (Panorama):** é um placar de 0 (aversão) a 100 (apetite), com medidor e regras fixas e públicas. Nove sinais recebem nota de −2 a +2 cada um:
  - Mundo: curva de juros dos EUA, variação mensal do Treasury de 10 anos, força do dólar e ciclo do G20;
  - Brasil: força do real, fluxo cambial dos últimos 3 meses, estrangeiros em ações e títulos, ciclo do Brasil e IPCA contra o teto da meta.

  Cada sinal mostra o valor, a nota, a seta em relação a um mês atrás e o porquê, com link para a análise. O número geral também se compara ao de um mês atrás. É uma leitura sintética, não uma recomendação de investimento.
- **Ficha completa do país:** reúne numa página tudo o que a plataforma sabe de uma economia. Mostra a moeda contra o dólar e a força entre as 10 moedas, a fase do ciclo da OCDE com a curva de 24 meses, inflação, juros, desemprego e PIB, se a bolsa está aberta agora, os indicadores com a média mundial ao lado, a agenda e a notícia oficial. Abre pelo botão **Ficha completa** no mapa, pela busca ("Alemanha" → Ficha) e pelo relógio do ciclo. Tem endereço próprio (**#ficha/BRA**), com botão **Copiar link** para compartilhar.
- **Bolsas agora (Mercados):** um bloco com duas visões. **Roteiro do pregão** muda sozinho conforme o horário da B3 (antes da abertura, pregão aberto, depois do fechamento) e mostra o que olhar em cada momento; **Bolsas do mundo** mostra os índices por região e quais pregões estão abertos.
  - **Cotações:** widget do TradingView com futuros dos EUA, Brasil em Nova York (EWZ e ADRs de Petrobras, Vale, Itaú, Bradesco e Nubank), commodities, DXY e Treasuries. Depois do fechamento, entram Ibovespa, small caps e IFIX.
  - **Roteiro ao lado, com dados da plataforma:** o mundo agora (Ásia, Europa, Nova York e São Paulo), a agenda do dia, dólar e juros, o termômetro de risco e o fluxo cambial do BCB.
  - **Volume e origem do pregão:** vêm do relatório *Dados de Mercado* da B3 (CSV ou .xlsx). Ele é baixado à mão e salvo em `data/b3/`, porque a B3 veda a coleta automática. A exibição a terceiros depende de licença de Market Data.
- **O que o mercado precifica (Brasil):** com as taxas diárias do Tesouro Direto, a plataforma monta a curva de juro nominal (prefixados) e a de juro real (IPCA+) e calcula a **inflação implícita** entre elas, a inflação média que deixa os dois títulos empatados. Quatro números abrem a seção: inflação implícita de 5 anos (comparada ao Focus no mesmo período), juro real de 5 anos, prefixado de 1 ano (comparado à Selic) e a distância da meta, cada um com a variação em um mês. Uma frase resume se o mercado acredita na volta da inflação à meta e se embute alta ou corte de juros. Três visões: inflação implícita até cada vencimento contra o Focus e a meta, dois anos de histórico e a taxa de cada título com a variação no mês.
- **Pregão B3 (Mercados):** volume médio por pregão mês a mês contra a média do ano anterior, saldo mensal dos estrangeiros, participação por tipo de investidor e uma leitura em texto do mês. Importando o relatório todo dia, a seção mostra também cada pregão (diferença entre dois relatórios).
- **Mercados:** Bolsas agora, pregão da B3, mapas de calor ao vivo, **Força das moedas**, comparador de câmbio e mercados acompanhados. A Força das moedas ranqueia o dólar e as nove moedas do BCE pela variação média contra as outras no dia, na semana, no mês ou em 3 meses, com uma frase de leitura, a trajetória de cada moeda e uma matriz cruzada colorida. Um toque num par da matriz abre os dois no comparador, no período equivalente.
- **Brasil:** abre com a **Bússola dos juros**: Selic e IPCA em 12 meses realizados, a meta de inflação com o intervalo de tolerância e o caminho esperado pelo Focus até o último ano projetado, num só gráfico. Ao lado aparecem o juro real ex-ante (Selic descontada do IPCA esperado para o ano seguinte) e o ano em que o mercado vê o IPCA de volta ao intervalo. Depois vêm os indicadores, o Focus em gráficos (mediana de cada ano, tendência semanal e como a expectativa mudou desde julho; a tabela continua disponível), o fluxo cambial e os fundos.
- **Global:** abre com o **Relógio do ciclo econômico**. Cada economia do G20 aparece como uma bandeira num plano: na horizontal, o indicador antecedente da OCDE (100 = tendência); na vertical, a variação no mês. Os quadrantes são as fases expansão, desaceleração, contração e recuperação. Um toque numa bandeira mostra o caminho dos últimos seis meses, há quanto tempo o país está na fase e os números. Ao lado, as economias aparecem agrupadas por fase. Em seguida vêm a curva de juros dos EUA, agora com o **sinal de recessão** (10 anos − 2 anos desde 2025, com os dias de curva invertida em vermelho), a lista do indicador antecedente, a **Agenda com impacto** e as notícias. A agenda traz os eventos que movem o mercado até o fim do ano (Copom, FOMC, BCE, IPCA, IPCA-15, PIB, PNAD, indústria, varejo, serviços, payroll, CPI e Focus), com datas conferidas nos calendários oficiais e horário local. Ao abrir um evento aparecem o número anterior, o esperado (a inflação mensal implícita no Focus e a Selic do Focus) e o que muda se vier acima ou abaixo. Há filtros por país e por importância. No Panorama, **Próximos eventos** mostra os de peso das duas semanas seguintes.

Países aparecem com bandeira e moedas com o selo do emissor em círculo; um par cambial mostra os dois selos sobrepostos, como nas plataformas de mercado. As bandeiras são desenhos simplificados do próprio Observatório, em `web/symbols.js`, sem pacote externo; territórios sem desenho mostram o código ISO.

O endereço guarda o espaço (`#/brasil`) ou a parte (`#fluxo`), então os links diretos abrem no lugar certo. Sem endereço, a página volta ao último espaço usado. Os módulos são `web/desks.js` (espaços) e `web/pulse.js` (pulso).

## Usar o atlas

- Clique em um território, um marcador, um cartão de câmbio ou um nome na tabela. A ficha indica mercado, par, nível, variação do par, histórico e cobertura.
- Selecione uma região para reenquadrar o mapa e filtrar a lista. Pesquise por **Zona do Euro** para destacar o bloco. A tecla **/** (ou **Ctrl+K**) abre a busca universal. Digite um país, região, moeda, par ou índice, ou um assunto como **Selic**, **fluxo**, **euro** ou **recessão**: a busca leva direto à parte certa, em qualquer espaço. Com a busca vazia aparecem sugestões, e um país também abre o seu ponto no relógio do ciclo. Enter seleciona o primeiro resultado. Tab percorre os resultados, Esc fecha a janela.
- Arraste o mapa ou use a roda do mouse. Com foco no mapa, use as setas, **+**, **−** e **Home**. O botão de enquadramento restaura a região corrente.
- Alterne o intervalo do gráfico entre 7, 30 e 90 dias corridos. A tabela em **Ver origem e metodologia** mostra todas as observações disponíveis. Tema, país, região e intervalo ficam no armazenamento local do navegador, por endereço.
- **Fontes** apresenta saúde, tentativas, latência, datas de coleta e observação, identificador da captura, metodologia e direitos. O indicador de saúde representa a consulta ao BCE. A sessão das bolsas depende de calendário próprio e está identificada como não verificada.

## Câmbio e comparação

O atlas abre em USD. O primeiro cartão é USD/BRL. O seletor de moeda-base também oferece EUR e atualiza a ficha, o mapa, a tabela, o histórico, o comparador e as marcações mensais dos ativos. Em **Origem e método** é possível conferir os pares de entrada. Use **Comparar este par** para levá-lo ao comparador. Escolha o segundo par e uma janela de 7, 30 ou 90 dias. O gráfico coloca ambas as séries em 100 na primeira observação comum. **Dados e método** mostra as datas, os valores normalizados e a captura utilizada.

[Relatório da atualização visual e cambial](docs/atlas-e-cambio.md)

## Heatmaps de ativos

Em **Heatmap**, escolha Cripto, Ações EUA ou Ações Brasil. Cada bloco abre a marcação por unidade, a variação na moeda selecionada e a amostra de fundos. Os links locais `/?heatmap=crypto`, `/?heatmap=us` e `/?heatmap=br` abrem cada mercado diretamente. As fichas geográficas do Brasil e dos EUA também dão acesso às ações correspondentes.

A edição inicial de outubro de 2026 acompanha 24 ativos. Na consulta ao heatmap, o servidor verifica a última competência encerrada. Enquanto a nova edição é preparada, serve a edição disponível com suas datas. Uma falha permite nova tentativa após 24 horas. Para republicar uma competência após revisão dos dados de origem, execute `python -m scripts.heatmaps 2026-10` na pasta do projeto. As duas competências precisam estar no histórico cambial disponível. O comando utiliza dois arquivos oficiais da CVM e o cache cambial compartilhado em disco.

[Metodologia e cobertura](docs/heatmaps-mensais.md)

## O que o mercado precifica

O arquivo de preços e taxas do Tesouro Direto (Tesouro Transparente, cerca de 15 MB com histórico desde 2002) é baixado a cada 6 horas, com até três tentativas porque o servidor às vezes derruba a conexão. O servidor guarda só o resumo calculado em `data/cache/tesouro.json`. Curva nominal: LTN e NTN-F; curva real: NTN-B Principal e NTN-B. Taxa de cada título: média entre compra e venda. Prazos constantes (1, 2 e 5 anos no prefixado; 5 e 10 no real) são interpolados linearmente entre vencimentos. Inflação implícita = (1 + prefixado) ÷ (1 + IPCA+) − 1. O prefixado que vence antes do primeiro IPCA+ usa a taxa do IPCA+ mais curto e aparece como estimado. O Focus de comparação é a média geométrica das medianas anuais no mesmo período; anos além do horizonte do Focus repetem o último ano. A inflação implícita inclui prêmio de risco, então costuma ficar acima da expectativa pura.

## Ao vivo

O servidor consulta cada canal no seu intervalo (5 minutos para as notas do BC e a Agência Brasil, 15 para BC, IBGE, Fed e BCE, 3 horas para o arquivo de fatos relevantes da CVM, que chega com alguns dias de atraso). A coleta roda em segundo plano quando alguém abre a página e há canal vencido; a página pede a lista a cada minuto. Ficam em `data/cache/noticias.json` só título, resumo de até 240 caracteres, link, hora, tema e impacto, por 7 dias.

Tema e impacto vêm de regras fixas de palavras-chave (`providers/news.py`), iguais para todas as fontes, sem modelo de IA. Alto impacto: decisão de juros, leilão ou intervenção no câmbio, medida fiscal (IOF, bloqueio, meta, reforma) e dados de peso (IPCA, PIB, desemprego, CPI, payroll). Palavra só no resumo vale um nível a menos; rotinas como rolagem de swaps, estudos e relatórios também. Cada canal aparece na Saúde das fontes; canal fora do ar é atenção, não falha.

Ficaram de fora: as notícias do Planalto e dos ministérios, cujos feeds estão parados ou exigem login, e agências privadas (Reuters, Bloomberg, Valor), que exigem licença.

## Bolsas agora

O bloco **Bolsas agora** reúne num só lugar o que antes eram duas seções (pré e pós-mercado e índices mundiais), com o estado da B3 sempre no topo e duas visões:

- **Roteiro do pregão** responde "o que olhar agora para a bolsa brasileira". Escolhe sozinho o momento pelo relógio da B3, ou o usuário fixa um deles. Antes da abertura: contratos dos EUA, ADRs brasileiros e EWZ, Europa e Ásia, commodities, dólar e juros. Pregão aberto: Ibovespa, small caps, IFIX, as ações de maior peso no índice (Vale, Petrobras, Itaú, Bradesco, BB, B3), Wall Street, ADRs e commodities. Depois do fechamento: como o Brasil terminou, ADRs no after-market, EUA, Ásia abrindo e commodities. Ao lado, um roteiro com dados da plataforma: bolsas abertas no mundo, agenda do dia (ou de amanhã), dólar e juros, fluxo cambial, termômetro de risco e o pregão B3 importado.
- **Bolsas do mundo** responde "como estão os índices de cada região". Cada região traz os pregões abertos ou fechados, com hora local e quanto falta.

Uma legenda recolhível explica índice à vista, contrato, ADR, EWZ, VIX, DXY e o atraso das cotações. Os endereços antigos `#prepos` e `#indices` continuam abrindo a visão certa.

A visão **Bolsas do mundo** resume a tela de índices globais dos terminais profissionais no que importa para consulta rápida. São quatro regiões: Américas, Europa, Ásia-Pacífico e Referências (DXY, VIX, dólar em reais, ouro, Brent e bitcoin). Cada uma mostra valor, variação do dia e gráfico do índice escolhido, pelo widget público do TradingView. Alguns índices aparecem por contratos que os acompanham, indicados como "contrato". Ao lado, **Pregões agora** informa se cada bolsa da região está aberta, em intervalo ou fechada, quanto falta para fechar ou abrir, e a hora local. Esse cálculo é feito no navegador a partir do horário regular de cada bolsa, sem feriados. P/L, estimativas e dividendos ficaram de fora por falta de fonte gratuita licenciada.

## Mapas de calor ao vivo

A seção **Mapas de calor ao vivo** reproduz os heatmaps do CryptoLab V2 com o widget público do TradingView: cripto por valor de mercado e variação em 24 h, S&P 500 e Ibovespa por setor. O widget só carrega quando a seção aparece na tela, acompanha o tema claro ou escuro e mantém a atribuição do TradingView. É provisório: os termos do TradingView vetam uso comercial sem acordo, então antes de cobrar assinatura é preciso fechar acordo ou substituir `web/live-heat.js` e `web/prepos.js`, que dependem de `web/tv-widget.js`. O heatmap mensal calculado a partir da CVM continua na aba Heatmap do mapa.

## Fluxo de capital

A seção **Fluxo de capital · Brasil** mostra quanto dinheiro entrou e saiu do país pelo câmbio, em camadas de tempo:

- **No ano:** fluxo cambial total, comercial (exportação − importação) e financeiro (compras − vendas), comparados ao mesmo período do ano anterior, e a posição de câmbio dos bancos com o volume do interbancário.
- **Mês a mês e dia a dia:** barras do comercial e do financeiro com o total, nos últimos 13 meses ou nos últimos 25 dias úteis divulgados.
- **Quem moveu:** capitais estrangeiros, capitais brasileiros, serviços e rendas no câmbio contratado.
- **Estrangeiros: onde aplicaram:** investimento direto, ações, renda fixa e fundos no balanço de pagamentos.
- **Banco Central no câmbio:** volume aceito por instrumento no ano (à vista, linhas e swaps) e os últimos leilões.
- **Fundos:** captação menos resgate das classes de fundos por categoria (renda fixa, multimercado, ações, previdência, cambial e outros), no ano com o mesmo período do ano anterior, mês a mês e dia a dia, e a divisão do patrimônio. Vem do informe diário da CVM; fundos de cotas ficam fora para não contar o mesmo dinheiro duas vezes, e o dia só entra quando ao menos 95% das classes já reportaram. A primeira coleta baixa cerca de 23 arquivos mensais (≈ 12 MB cada) em segundo plano.

Câmbio e balanço de pagamentos vêm do BCB e os fundos da CVM, ambos sob ODbL. O câmbio contratado diário sai com cerca de uma semana de defasagem, e as séries por agente são mensais. A participação de estrangeiros, institucionais e pessoa física na B3, e o fluxo por ação, dependem de autorização da B3 e não entram nesta versão.

## Camada macro

A API `/api/macro` reúne 13 séries brasileiras do BCB, 9 do IBGE, a PTAX de USD e EUR, as expectativas do Focus para 8 indicadores, a curva de juros diária do Tesouro dos EUA, séries mensais e trimestrais do Eurostat e da OCDE e 9 indicadores anuais do Banco Mundial por país. O catálogo fica em `config/macro.json`.

Na interface, a camada aparece em quatro pontos: o **Painel Brasil** (cartões por tema com histórico e a tabela do Focus), **Juros e ciclo global** (curva dos EUA e indicador antecedente da OCDE), a aba **Indicadores** do mapa (coroplético em quintis, com seletor do indicador) e o bloco **Indicadores macro** da ficha de cada país.

[Camada macro: fontes, cache e rotas](docs/camada-macro.md)

## Sobre, primeira visita e compartilhamento

- **Sobre e fontes:** o botão do menu lateral (ou o endereço `#sobre`) abre a página Sobre. Ela traz:
  - o que é a plataforma e o que há em cada espaço;
  - como ler os números;
  - a tabela de fontes com a condição de uso de cada uma (liberada, provisória ou com licença pendente);
  - a privacidade.

  Os detalhes do câmbio do BCE continuam acessíveis a partir dela.
- **Primeira visita:** um tour de cinco passos mostra os espaços, a busca, o painel personalizável, a saúde das fontes e a página Sobre. Ele aparece uma vez, fica marcado no navegador e pode ser refeito pela página Sobre.
- **Compartilhamento:** a página tem descrição, Open Graph e cartão do Twitter com a imagem `web/og.png` (1200×630). Ao publicar num domínio, troque `og:image` pelo endereço completo (`https://…/og.png`), que algumas redes exigem.

## Saúde das fontes

O botão no topo da página resume todas as coletas: "Fontes em dia", quantas pedem atenção ou quantas falharam. Ao clicar, abre o painel com cada série (BCE, Banco Central, IBGE, Tesouro dos EUA, OCDE e Eurostat, Banco Mundial, CVM e B3), com:

- a situação;
- a última observação publicada pela fonte;
- quando o Observatório coletou;
- o erro, se houver.

Uma coleta parada há mais de 6 horas aparece como atrasada. O relatório da B3 importado há mais de 4 dias também aparece como atrasado e pede nova importação. Quando uma seção não consegue dados, mostra o mesmo aviso padrão com um atalho para esse painel.

## Desempenho

- **Dados compartilhados:** `web/data.js` busca cada endereço da API uma vez por minuto e entrega uma cópia a cada seção que pede o mesmo dado.
- **Carga por espaço:** as seções de Mercados e Brasil só buscam dados e se desenham quando o espaço é aberto.
- **Compressão e cache:** o servidor comprime em gzip textos, scripts, estilos e JSON acima de 1 KB. Cada resposta leva um `ETag`; se o conteúdo não mudou, o navegador recebe `304` sem corpo.
- **Arquivos estáticos:** o servidor entrega qualquer `.html`, `.css`, `.js`, `.json`, `.svg` ou `.ttf` que esteja direto em `web/`, e nada fora dessa pasta.

## Estrutura

| Diretório | Responsabilidade |
|---|---|
| web | Página, busca, estilos, gráfico e mapa SVG local |
| config | Catálogo de mercados e vínculo explícito com a série de referência |
| providers | Adaptadores do BCE e dos informes públicos da CVM |
| core | Cálculos com Decimal e calendário TARGET |
| server | API HTTP, validade, integridade e cache compartilhado |
| data/cache | Captura cambial, edição mensal atualizada e controle de tentativas |
| data/editions | Edição inicial mensal com procedência e atribuição |
| data/run | Saída local dos scripts de execução |
| scripts | Início, encerramento e utilitário de preparação da cartografia |
| tests | Testes determinísticos e roteiro executável de navegador |
| docs | Matriz de fontes, contrato, licença tipográfica e relatório com capturas |

### Frontend (`web/`)

| Módulo | Papel |
|---|---|
| `app.js` | Ponto de entrada: monta a moldura, os espaços e cada seção |
| `shell.js` | Ícones, tema claro/escuro e navegação lateral |
| `storage.js` | Preferências no navegador (`localStorage`, prefixo `oeg.`) |
| `format.js` | Formatação comum: texto seguro, números em pt-BR, sinais, tons e datas curtas |
| `data.js` | Busca compartilhada da API (uma vez por minuto por endereço) |
| `desks.js` | Espaços (Panorama, Mercados, Brasil, Global) e roteamento por endereço |
| `atlas.js` | Mapa, cotações, tabela, painel do país, busca e folhas de fontes do Panorama |
| demais | Uma seção cada: `pulse`, `risk`, `agenda`, `clock`, `news` (Ao vivo), `tesouro` (mercado precifica), `prepos` (Bolsas agora), `pregao`, `indices` (horários das bolsas), `live-heat`, `fx-board`, `comparison`, `compass`, `flows`, `funds`, `cycle-clock`, `macro`, `bulletin`, `dossier`, `glossary`, `finder` |

Uma seção nova é um módulo em `web/` com uma função de montagem chamada em `app.js`. O servidor entrega o arquivo sem cadastro.

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

Roteiro de fumaça, mais curto, para rodar a cada mudança com o servidor ativo:

```powershell
node tests/smoke.cjs http://127.0.0.1:8842
```

Ele abre os quatro espaços no tamanho de computador e de celular. Falha se encontrar:

- erro de script ou de CSP;
- resposta HTTP com erro;
- seção ausente, vazia ou em estado de falha;
- página mais larga que a tela.

Também confere o painel de saúde das fontes.

O teste de navegador requer pelo menos uma captura válida do BCE e verifica também uma falha simulada isolada na página de teste. O navegador alternativo pode ser definido em `OEG_BROWSER`. A bateria Python é offline.

[Fontes e permissões](docs/fontes.md) · [Contrato de dados](docs/contrato.md) · [Relatório da primeira entrega](docs/entrega-1.md)


## Revisão do atlas e das notícias — 18/11/2026

No Panorama, o atlas vem logo após o Pulso. O mapa mensal agrupa os ativos por setor e dimensiona os blocos pelas posições ou pelo volume informado pelos fundos. No mapa de mercado, a barra do TradingView permite alterar o tamanho, a cor e o agrupamento. Links diretos preservam o mercado escolhido entre as duas vistas. [Auditoria de continuidade](docs/auditoria-2026-11-18.md).
