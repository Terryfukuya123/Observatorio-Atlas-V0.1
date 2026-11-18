# Auditoria de continuidade · Observatório Econômico Global

**18 de novembro de 2026.** Ponto de partida: commit local `95714b3`, que entregou as notícias oficiais. A revisão percorreu os quatro espaços do produto, os contratos de dados do mapa, a busca, as notícias, os estados de falha e o comportamento no Chrome em desktop e celular. O Macro Radar do CryptoLab foi consultado na porta 8766. O Observatório opera de forma independente na porta 8842.

## O que mudou na jornada

| Achado | Correção e verificação |
|---|---|
| O principal diferencial ficava abaixo da lista de notícias, eventos e relógios. | O atlas agora aparece logo após o Pulso do dia. A navegação segue a ordem visual. O noticiário e o calendário continuam acessíveis por atalhos. |
| O mapa de pregão já tinha o widget do CryptoLab, mas escondia a barra de métricas. Era preciso descobrir o outro espaço e selecionar o mercado novamente. | Os mapas de ações Brasil, EUA e cripto têm endereços próprios. O vínculo entre o atlas mensal e o pregão acompanha o mercado. No Chrome, o Ibovespa exibiu papéis brasileiros e o menu de tamanho ofereceu volume e giro diário, semanal e mensal. |
| O mapa da CVM usava áreas iguais e a ficha só explicava o retorno. | Setores com área proporcional, foco por setor, zoom pela roda no cursor, deslocamento e seleção por ticker. A ficha apresenta posição, giro declarado e participação na cesta. A legenda identifica a concentração dos três maiores pesos. |
| A linha do tempo repetia a manchete e o botão de paginação voltava imediatamente a 25 itens. | O destaque aparece uma vez. Um roteiro de regressão com 54 notícias verifica dois avanços e 54 títulos únicos. |
| Uma busca exata por índice podia abrir uma ficha em outra janela da interface antes de selecionar o país no atlas. Um link mensal podia reabrir o último espaço visitado. | Buscas exatas por país ou índice priorizam o mapa. O link mensal abre o Panorama mesmo após uma visita a Mercados. |
| Uma resposta tardia da camada macro podia sobrescrever a legenda de outra camada após falha. | A aplicação confere a camada e a versão da solicitação antes de pintar o estado de erro. |
| O carregamento dos módulos de Mercados aguardava desnecessariamente a cartografia e o câmbio. Um widget substituído mantinha temporizadores da tentativa anterior. | A inicialização dos módulos foi desacoplada da espera pelo atlas. A substituição de widgets cancela observadores, temporizadores e eventos pendentes. |

## O que os dados permitem afirmar

A edição local cobre nove ações brasileiras, nove americanas e seis criptoativos. A variação mensal compara as marcações por unidade dos mesmos fundos nas duas competências. O tamanho reflete o conjunto das posições divulgadas no mês final ou as compras mais vendas declaradas. A participação usa o total informado da cesta selecionada. A CVM divulga carteiras de fundos. A abrangência de bolsa ou de exchange corresponde à camada de pregão do provedor.

Na edição de outubro, os nove papéis americanos têm posições divulgadas e campos de volume incompletos. O seletor de volume fica indisponível para essa cesta. BTC e ETH têm giro informado igual a zero na amostra. Continuam acessíveis no seletor de ativos. [Base da edição](http://127.0.0.1:8842/api/heatmaps) · [Dados abertos da CVM](https://dados.cvm.gov.br/dataset/fi-doc-cda).

## Lacunas e prioridades para consolidação

1. **Sessões e feriados.** Os relógios operam por horário regular. Para dar confiança à etiqueta “aberta”, integrar calendários oficiais por praça, incluindo feriados, sessões parciais e data de vigência. Validar primeiro B3 e Nova York.
2. **Distribuição profissional.** Os widgets do TradingView e os relatórios importados da B3 estão identificados como provisórios ou pendentes no cadastro de fontes. Confirmar para quais públicos, em quais modalidades e com que atraso podem ser exibidos antes de liberar o produto a terceiros. Esta entrega roda localmente. [Matriz de fontes](fontes.md).
3. **Espaço de trabalho do analista.** Uma próxima melhoria seria compartilhar um enquadramento completo do mapa por link, incluindo setor, métrica, ativo, moeda e competência. Hoje o link preserva o mercado. Um teste de usabilidade deve medir se o destinatário consegue reproduzir a leitura sem instruções adicionais.

## Execução e evidências

Windows, Python com biblioteca padrão, HTML, CSS e JavaScript. Na pasta `F:\Observatorio_Economico_Global`, iniciar com `.\scripts\start.ps1` e encerrar com `.\scripts\stop.ps1`. O servidor escuta no loopback. O mapa mensal usa os informes da CVM e o câmbio do BCE. O widget de pregão carrega diretamente do fornecedor. Toda alteração desta rodada foi feita no Observatório.

A bateria Python cobre os provedores e o servidor, inclusive negócios com posição encerrada, volume zero e campo ausente. O roteiro `tests/browser.cjs` exercita as jornadas do atlas e da paginação. `tests/smoke.cjs` verifica a navegação dos quatro espaços, saúde, origens, tour, falhas de carregamento e largura da página nos dois tamanhos de tela.


Resultado em 18/11/2026: **92 testes Python aprovados**. Os dois roteiros passaram no Chrome em 1440 px e 390 px de largura. O teste de fumaça percorreu Panorama, Mercados, Brasil e Global, exibiu 73 coletas em Saúde e 13 fontes na página Sobre.
