// Busca universal: além de países e regiões, leva a qualquer parte da plataforma pelo
// nome do assunto ("Selic", "fluxo", "recessão", "euro"), sem precisar saber em que
// espaço ele está.

export const DESTINATIONS = [
  ["#pulse", "Pulso do dia", "Panorama", "Os números do dia com leitura em uma frase", "resumo hoje manchete destaques dolar selic ipca reservas"],
  ["#relogio", "Relógio dos pregões", "Panorama", "Quais bolsas estão abertas agora", "bolsas abertas pregao horario abertura fechamento sessao asia europa"],
  ["#atlas", "Mapa e ficha do país", "Panorama", "Indicadores e câmbio por país no mapa", "mapa pais paises pib per capita inflacao crescimento heatmap mensal ativos"],
  ["#indices", "Índices mundiais", "Mercados", "Bolsas do mundo no dia", "indices bolsa acoes ibovespa sp500 s&p dow jones nasdaq nikkei dax ftse cac hang seng"],
  ["#aovivo", "Mapas de calor ao vivo", "Mercados", "Ações e cripto por setor e tamanho", "heatmap mapa de calor acoes setores cripto bitcoin ethereum ibovespa sp500"],
  ["#moedas", "Força das moedas", "Mercados", "Ranking e matriz cruzada de 10 moedas", "cambio moedas forex real dolar euro iene libra yuan rupia ranking matriz cruzada"],
  ["#comparison", "Comparador de câmbio", "Mercados", "Dois pares lado a lado em base 100", "comparar comparador pares cambio base 100"],
  ["#markets", "Mercados acompanhados", "Mercados", "Tabela de mercados, índices e pares", "tabela mercados acompanhados lista"],
  ["#bussola", "Bússola dos juros", "Brasil", "Selic, IPCA, meta e o caminho do Focus", "selic ipca juro real meta inflacao copom politica monetaria taxa de juros"],
  ["#brasil", "Indicadores do Brasil", "Brasil", "Atividade, inflação, emprego, crédito e contas", "pib ibc-br atividade desemprego emprego credito inadimplencia divida reservas igp-m industria varejo servicos"],
  ["#focus", "Expectativas · Focus", "Brasil", "O que o mercado espera para os próximos anos", "focus projecoes expectativas mercado mediana boletim"],
  ["#fluxo", "Fluxo cambial", "Brasil", "Quem trouxe e quem tirou dólares do país", "fluxo cambial cambio contratado estrangeiros investimento direto idp banco central swap leilao dolar entrada saida"],
  ["#fundos", "Fundos", "Brasil", "Para onde o investidor local levou o dinheiro", "fundos captacao resgate cvm renda fixa multimercado previdencia patrimonio investidor"],
  ["#ciclo", "Relógio do ciclo econômico", "Global", "Fase do ciclo de cada economia do G20", "ciclo economico ocde cli expansao desaceleracao contracao recuperacao g20 paises"],
  ["#juros", "Curva de juros dos EUA", "Global", "Treasuries de 1 mês a 30 anos", "curva juros eua estados unidos treasury tesouro fed 10 anos"],
  ["#recessionSignal", "Sinal de recessão", "Global", "Diferença entre os juros de 10 e 2 anos dos EUA", "recessao inversao curva invertida spread 10a 2a"],
  ["#bulletin", "Notícias e agenda", "Global", "Comunicados oficiais e calendário", "noticias calendario agenda copom fomc bce reuniao comunicados"],
  ["meta", "Fontes e metodologia", "Plataforma", "De onde vem cada dado e como é calculado", "fontes metodologia licenca dados origem"],
];

// Destinos que mais respondem perguntas do dia a dia, para a busca vazia.
export const SUGGESTED = ["#pulse", "#bussola", "#fluxo", "#moedas", "#ciclo", "#relogio"];

// Sem acento e em minúsculas, como a busca de mercados.
export const fold = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Pontua cada destino: título vale mais que palavra-chave; todas as palavras precisam casar.
export function findDestinations(query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return SUGGESTED.map((h) => DESTINATIONS.find((d) => d[0] === h));
  return DESTINATIONS.map((d) => {
    const title = fold(d[1]);
    const rest = fold(d[2] + " " + d[3] + " " + d[4]);
    let score = 0;
    for (const w of words) {
      if (title.split(/\s+/).some((t) => t.startsWith(w))) score += 3;
      else if (title.includes(w)) score += 2;
      // Palavra-chave inteira ("euro") vale mais que pedaço de outra ("europa").
      else if (rest.split(/\s+/).includes(w)) score += 1.5;
      else if (rest.includes(w)) score += 1;
      else return null;
    }
    return [score, d];
  })
    .filter(Boolean)
    .sort((a, b) => b[0] - a[0])
    .map(([, d]) => d);
}
