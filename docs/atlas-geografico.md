# Atlas, heatmap e informativo

Entrega local de 17/11/2026 em F:\Observatorio_Economico_Global, Windows 11. Na pasta do projeto, execute `.\scripts\start.ps1` e abra http://127.0.0.1:8842/. Para encerrar, use `.\scripts\stop.ps1`. A etiqueta Git `atlas-geografico-v3` identifica a versão demonstrada.

## Experiência

O Início e o Macro Radar da instância 8766 foram inspecionados no Google Chrome. A referência visual é o fundo grafite com grade discreta, o halo âmbar, a navegação lateral, os títulos serifados e as marcas nos cantos das janelas. A implementação pertence exclusivamente ao Observatório. Newsreader é servida localmente e tem sua licença em docs/Newsreader-OFL.txt.

O atlas abre antes dos demais painéis. Selecionar um país atualiza a ficha de mercado e a aba Notícias e agenda. Na tela cheia o mapa e a ficha permanecem juntos. Em larguras intermediárias a ficha se dispõe em faixa abaixo do mapa. No celular ela usa a largura disponível.

- **Cobertura** destaca mercados com observações disponíveis. O painel da seleção informa a validade.
- **Variação diária** apresenta o sinal do retorno do par EUR/moeda, calculado na API entre duas sessões TARGET. O verde significa valorização do euro naquele par. As fichas da área do euro usam EUR/USD como contexto comum.
- **Heatmap** reúne as nove séries em blocos de igual peso. Cada par aparece uma única vez no recorte. A cor sinaliza a direção. A intensidade muda nos limiares de 0,25% e 1% em valor absoluto. Só entram na escala valores numéricos, atualizados e com a mesma data final da observação mais recente; ausência e atraso ficam sem sinal. Clicar no bloco seleciona o mercado e retorna ao mapa.
- O heatmap setorial observado na 8766 é um componente do TradingView para o S&P 500, ponderado por capitalização. No Observatório, esse mapa abre na [página do fornecedor](https://www.tradingview.com/heatmap/stock/?dataset=SPX500). A exibição embutida para analistas externos depende da confirmação dos direitos. O heatmap cambial integrado utiliza o BCE e funciona localmente. [Condições do TradingView](https://www.tradingview.com/policies/).

## Informativo

A edição editorial de 17/11/2026 reúne três notas originais sobre decisões e três eventos com links primários para BCB, Fed e BCE. Cada item mostra a instituição e a data da decisão ou do evento. A edição é datada e atualizada manualmente em web/bulletin.js. O filtro da ficha decorre do país ou bloco selecionado. Sem item local, a ficha informa a lacuna e oferece o panorama global. O navegador somente visita os sites de terceiros quando o leitor abre um link.

## Evidências

A suíte Python executou 19 testes. O roteiro de navegador em Chrome verificou a abertura pelo mapa, troca de camadas, tela cheia, expansão da barra lateral, contexto editorial de Brasil e EUA, nove blocos cambiais, seleção pelo bloco, tema claro e escuro, layout móvel, comparação e ausência de sinal na falha da fonte. A inspeção visual encontrou uma sobreposição do SVG sobre o mosaico. A correção foi aplicada e a jornada foi repetida no Chrome.

Próximo incremento sugerido: ampliar a cobertura editorial por autoridade monetária e registrar revisões dos eventos. A expansão para mapas setoriais embutidos requer fonte e direitos específicos para essa utilização.

[Atlas](evidencias/atlas-geografico/panorama.png) · [Heatmap](evidencias/atlas-geografico/heatmap.png) · [Celular](evidencias/atlas-geografico/mobile.png)
