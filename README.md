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

- **Panorama:** abre com a **manchete do dia**, uma frase com os números que importam (dólar, Selic, IPCA, fluxo e fundos no ano, bolsas abertas). Em seguida vem o **Pulso do dia**: dólar, Selic, IPCA, fluxo cambial, fundos, juros dos EUA, reservas e bolsas abertas, cada número com uma leitura em uma frase e um link para a análise completa. Depois aparece o **Relógio dos pregões**, com as 24 horas do seu dia, a janela de cada bolsa, o almoço das asiáticas e a linha do agora. Por fim, o mapa e a ficha do país.
- **Mercados:** índices mundiais, mapas de calor ao vivo, comparador de câmbio e mercados acompanhados.
- **Brasil:** indicadores, expectativas do Focus, fluxo cambial e fundos.
- **Global:** curva de juros dos EUA, indicador antecedente da OCDE, notícias e agenda.

Países aparecem com bandeira e moedas com o selo do emissor em círculo; um par cambial mostra os dois selos sobrepostos, como nas plataformas de mercado. As bandeiras são desenhos simplificados do próprio Observatório, em `web/symbols.js`, sem pacote externo; territórios sem desenho mostram o código ISO.

O endereço guarda o espaço (`#/brasil`) ou a parte (`#fluxo`), então os links diretos abrem no lugar certo. Sem endereço, a página volta ao último espaço usado. Os módulos são `web/desks.js` (espaços) e `web/pulse.js` (pulso).

## Usar o atlas

- Clique em um território, um marcador, um cartão de câmbio ou um nome na tabela. A ficha indica mercado, par, nível, variação do par, histórico e cobertura.
- Selecione uma região para reenquadrar o mapa e filtrar a lista. Pesquise por **Zona do Euro** para destacar o bloco. A tecla **/** abre a busca. Digite um país, região, moeda, par ou índice. Enter seleciona o primeiro resultado. Tab percorre os resultados, Esc fecha a janela.
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

## Índices mundiais

A seção **Índices mundiais** resume a tela de índices globais dos terminais profissionais no que importa para consulta rápida. São quatro regiões: Américas, Europa, Ásia-Pacífico e Referências (DXY, VIX, dólar em reais, ouro, Brent e bitcoin). Cada uma mostra valor, variação do dia e gráfico do índice escolhido, pelo widget público do TradingView. Alguns índices aparecem por contratos que os acompanham, indicados como "contrato". Ao lado, **Pregões agora** informa se cada bolsa da região está aberta, em intervalo ou fechada, quanto falta para fechar ou abrir, e a hora local. Esse cálculo é feito no navegador a partir do horário regular de cada bolsa, sem feriados. P/L, estimativas e dividendos ficaram de fora por falta de fonte gratuita licenciada.

## Mercados ao vivo

A seção **Mercados ao vivo** reproduz os heatmaps do CryptoLab V2 com o widget público do TradingView: cripto por valor de mercado e variação em 24 h, S&P 500 e Ibovespa por setor. O widget só carrega quando a seção aparece na tela, acompanha o tema claro ou escuro e mantém a atribuição do TradingView. É provisório: os termos do TradingView vetam uso comercial sem acordo, então antes de cobrar assinatura é preciso fechar acordo ou substituir `web/live-heat.js` e `web/indices.js`, que dependem de `web/tv-widget.js`. O heatmap mensal calculado a partir da CVM continua na aba Heatmap do mapa.

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
