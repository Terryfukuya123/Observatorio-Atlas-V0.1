// Glossário "O que é isso?": cada indicador explicado em duas frases (o que é e por que
// importa). Um botão "?" aparece nos cartões e nos títulos das seções e abre um balão.
// Os botões são postos por um observador, então cartões desenhados depois também ganham o seu.

export const GLOSSARY = {
  selic: {
    term: "Selic meta",
    what: "Taxa básica de juros do Brasil, definida pelo Copom do Banco Central a cada 45 dias.",
    why: "É a referência para o crédito e a renda fixa. Subir a Selic encarece o dinheiro e segura a inflação; cortar estimula a economia.",
  },
  selic_efetiva: {
    term: "Selic efetiva",
    what: "Taxa média dos empréstimos de um dia entre bancos, lastreados em títulos públicos. Fica um pouco abaixo da meta.",
    why: "É o juro que de fato remunera o dinheiro no dia a dia e anda colada ao CDI.",
  },
  inflation: {
    term: "IPCA em 12 meses",
    what: "Inflação oficial do Brasil, medida pelo IBGE, somada nos últimos 12 meses.",
    why: "É o número que o Banco Central persegue: a meta é 3%, com tolerância de 1,5 ponto para cima ou para baixo.",
  },
  ipca_mes: {
    term: "IPCA no mês",
    what: "Variação dos preços ao consumidor no mês, medida pelo IBGE.",
    why: "Mostra a direção da inflação antes que ela apareça no acumulado de 12 meses.",
  },
  igpm_mes: {
    term: "IGP-M",
    what: "Índice de preços da FGV com peso grande do atacado, de matérias-primas e do dólar.",
    why: "Reajusta aluguéis e contratos e costuma antecipar pressões que depois chegam ao consumidor.",
  },
  ibcbr: {
    term: "IBC-Br",
    what: "Índice de Atividade Econômica do Banco Central: uma prévia mensal do PIB, sem efeitos sazonais.",
    why: "Mostra o ritmo da economia mês a mês, antes de o IBGE divulgar o PIB do trimestre.",
  },
  pib_mensal: {
    term: "PIB mensal",
    what: "Estimativa do Banco Central do PIB do mês, em reais correntes (sem descontar a inflação).",
    why: "Serve de base para medidas em relação ao PIB, como a dívida pública.",
  },
  pib_anual: {
    term: "PIB, variação anual",
    what: "Crescimento real (descontada a inflação) de tudo o que o país produziu no ano.",
    why: "É a medida mais ampla de quanto a economia cresceu.",
  },
  pib_trimestre: {
    term: "PIB no trimestre",
    what: "Crescimento real do PIB em relação ao trimestre anterior, sem efeitos sazonais.",
    why: "Dois trimestres seguidos de queda costumam ser chamados de recessão técnica.",
  },
  pib_trimestre_ano: {
    term: "PIB, variação anual do trimestre",
    what: "Crescimento do PIB contra o mesmo trimestre do ano anterior.",
    why: "Elimina a sazonalidade comparando períodos iguais e mostra a tendência.",
  },
  dbgg: {
    term: "Dívida bruta do governo geral",
    what: "Tudo o que União, estados, municípios e INSS devem, em proporção do PIB.",
    why: "É a medida de endividamento usada nas comparações internacionais. Quando sobe, os juros longos tendem a subir.",
  },
  dlsp: {
    term: "Dívida líquida do setor público",
    what: "Dívida do setor público, incluindo o Banco Central e as estatais, descontados os ativos (como as reservas).",
    why: "Mostra o endividamento descontando o que o governo tem a receber.",
  },
  reserves: {
    term: "Reservas internacionais",
    what: "Moedas estrangeiras e ativos externos em poder do Banco Central.",
    why: "São o colchão do país contra choques: em crise, o BC pode vender dólares para conter a alta do câmbio.",
  },
  credito: {
    term: "Saldo de crédito",
    what: "Total de empréstimos e financiamentos do sistema financeiro a famílias e empresas.",
    why: "Crédito em alta sustenta consumo e investimento. Quando trava, a economia desacelera.",
  },
  inadimplencia: {
    term: "Inadimplência",
    what: "Parte da carteira de crédito com atraso acima de 90 dias.",
    why: "Sobe quando famílias e empresas ficam apertadas e leva os bancos a emprestar menos.",
  },
  desocupacao: {
    term: "Taxa de desocupação",
    what: "Parte das pessoas que procuraram emprego e não encontraram, em trimestres móveis (PNAD Contínua, IBGE).",
    why: "Desemprego baixo aquece salários e pode pressionar a inflação de serviços.",
  },
  industria_mes: {
    term: "Produção industrial",
    what: "Volume produzido pela indústria (PIM, IBGE), comparado ao mês anterior e sem efeitos sazonais.",
    why: "É sensível aos juros e ao crédito e costuma virar antes do resto da economia.",
  },
  industria_ano: {
    term: "Produção industrial, anual",
    what: "Volume produzido pela indústria contra o mesmo mês do ano anterior.",
    why: "Mostra a tendência sem o ruído de um mês isolado.",
  },
  varejo_mes: {
    term: "Vendas do varejo",
    what: "Volume vendido pelo comércio varejista (PMC, IBGE), comparado ao mês anterior e sem efeitos sazonais.",
    why: "Termômetro do consumo das famílias, que é a maior parte do PIB.",
  },
  varejo_ano: {
    term: "Vendas do varejo, anual",
    what: "Volume de vendas do varejo contra o mesmo mês do ano anterior.",
    why: "Mostra a tendência do consumo sem o ruído de um mês isolado.",
  },
  servicos_mes: {
    term: "Volume de serviços",
    what: "Receita real do setor de serviços (PMS, IBGE), comparada ao mês anterior e sem efeitos sazonais.",
    why: "Serviços são o maior setor da economia e a parte mais teimosa da inflação.",
  },
  servicos_ano: {
    term: "Volume de serviços, anual",
    what: "Receita real dos serviços contra o mesmo mês do ano anterior.",
    why: "Mostra a tendência do setor sem o ruído de um mês isolado.",
  },
  dollar: {
    term: "PTAX",
    what: "Taxa de câmbio de referência do Banco Central, calculada a partir de consultas aos bancos em quatro janelas do dia.",
    why: "Liquida contratos, derivativos e dívidas em dólar. Dólar mais caro encarece importados e pressiona a inflação.",
  },
  flow: {
    term: "Fluxo cambial",
    what: "Diferença entre os dólares que entraram e os que saíram do país pelo câmbio, no comercial (exportação e importação) e no financeiro (investimentos, remessas).",
    why: "Fluxo positivo tende a fortalecer o real; saída forte costuma pressionar o dólar para cima.",
  },
  funds: {
    term: "Captação líquida dos fundos",
    what: "Aplicações menos resgates nos fundos de investimento, segundo o informe diário da CVM.",
    why: "Mostra para onde o investidor local está levando o dinheiro: renda fixa, ações, multimercado ou previdência.",
  },
  treasury: {
    term: "Treasury de 10 anos",
    what: "Juro pago pelo título de 10 anos do Tesouro dos EUA.",
    why: "É a referência global para o custo do dinheiro. Quando sobe, o dólar costuma ganhar força e os emergentes sofrem.",
  },
  spread: {
    term: "Spread 10 anos − 2 anos",
    what: "Diferença entre os juros dos títulos americanos de 10 e de 2 anos.",
    why: "Quando fica negativo (curva invertida), o mercado espera cortes de juros à frente. Isso antecedeu as últimas recessões nos EUA.",
  },
  curva: {
    term: "Curva de juros",
    what: "Juros pagos pelo Tesouro dos EUA em cada prazo, de 1 mês a 30 anos.",
    why: "O formato da curva mostra o que o mercado espera para juros, inflação e crescimento.",
  },
  sessions: {
    term: "Pregões",
    what: "Horário regular de negociação de cada bolsa, no fuso deste dispositivo.",
    why: "Mostra quais mercados estão formando preço agora e quando o próximo abre.",
  },
  focus: {
    term: "Boletim Focus",
    what: "Pesquisa semanal do Banco Central com cerca de 100 instituições. Mostra a mediana das projeções para inflação, PIB, câmbio e Selic.",
    why: "É o termômetro das expectativas: o Copom acompanha de perto se elas se afastam da meta.",
  },
  juro_real: {
    term: "Juro real",
    what: "Selic descontada da inflação esperada. Aqui, usamos o IPCA projetado pelo Focus para os próximos 12 meses.",
    why: "Mede o quanto a política de juros está apertada. Acima de 4 a 5% ao ano, ela freia a economia.",
  },
  cli: {
    term: "Indicador antecedente (CLI)",
    what: "Indicador da OCDE que combina dados que costumam virar antes da economia. 100 é a tendência de longo prazo.",
    why: "Antecipa viradas do ciclo em 6 a 9 meses: acima de 100 e subindo é expansão; abaixo e caindo é contração.",
  },
  forca: {
    term: "Força da moeda",
    what: "Quanto cada moeda subiu ou caiu, em média, contra as outras nove no período.",
    why: "Separa o movimento da própria moeda do movimento do dólar: mostra quem de fato ganhou ou perdeu valor.",
  },
  termometro: {
    term: "Termômetro de risco",
    what: "Placar do Observatório que junta nove sinais (juros e dólar no mundo, ciclo, real, fluxo, estrangeiros e inflação) numa nota de 0 a 100.",
    why: "Resume se o ambiente favorece ou afasta o investidor de ativos brasileiros. Cada sinal mostra a própria nota e o porquê.",
  },
  comparador: {
    term: "Base 100",
    what: "Os dois pares começam em 100 no início do período, e a linha mostra a variação a partir daí.",
    why: "Permite comparar moedas de preços muito diferentes no mesmo gráfico.",
  },
};

// Séries com nome diferente no Brasil e no Pulso.
const ALIAS = { selic_meta: "selic", ipca_12m: "inflation", reservas: "reserves", "ptax:USD": "dollar", "ptax:EUR": "dollar" };
const termOf = (id) => {
  const key = ALIAS[id] || (id.startsWith("s:") ? ALIAS[id.slice(2)] || id.slice(2) : id);
  return GLOSSARY[key] ? key : null;
};

// Títulos de seção que ganham o "?".
const SECTIONS = {
  cpTitle: "juro_real",
  focusTitle: "focus",
  fluxoTitle: "flow",
  fundTitle: "funds",
  ccTitle: "cli",
  cliTitle: "cli",
  fxTitle: "forca",
  compareTitle: "comparador",
  rkTitle: "termometro",
  curveTitle: "curva",
};

const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function button(key, cls = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "gloss" + (cls ? " " + cls : "");
  b.dataset.term = key;
  b.setAttribute("aria-label", "O que é " + GLOSSARY[key].term + "?");
  b.setAttribute("aria-haspopup", "dialog");
  b.textContent = "?";
  return b;
}

// Põe o botão onde ainda não tem.
function decorate() {
  for (const [id, key] of Object.entries(SECTIONS)) {
    const h = document.getElementById(id);
    if (h && !h.querySelector(".gloss")) h.append(button(key, "inline"));
  }
  const rs = document.querySelector("#recessionSignal .rsHead h3");
  if (rs && !rs.querySelector(".gloss")) rs.append(button("spread", "inline"));
  for (const card of document.querySelectorAll(".macroTile[data-series]")) {
    const key = termOf(card.dataset.series);
    const h = card.querySelector("h4");
    if (key && h && !h.querySelector(".gloss")) h.append(button(key, "inline"));
  }
  for (const cell of document.querySelectorAll(".pulseCell[data-key]")) {
    const key = termOf(cell.dataset.key);
    if (key && !cell.querySelector(":scope > .gloss")) cell.append(button(key, "corner"));
  }
}

export function glossary() {
  const tip = document.createElement("div");
  tip.className = "glossTip";
  tip.setAttribute("role", "dialog");
  tip.hidden = true;
  document.body.append(tip);
  let owner = null;

  function close() {
    if (tip.hidden) return;
    tip.hidden = true;
    owner?.setAttribute("aria-expanded", "false");
    owner = null;
  }

  function open(btn) {
    const g = GLOSSARY[btn.dataset.term];
    owner?.setAttribute("aria-expanded", "false");
    owner = btn;
    btn.setAttribute("aria-expanded", "true");
    tip.setAttribute("aria-label", g.term);
    tip.innerHTML =
      '<strong>' + esc(g.term) + "</strong><p>" + esc(g.what) + '</p><p class="why"><b>Por que importa:</b> ' + esc(g.why) + "</p>";
    tip.hidden = false;
    // Abaixo do botão, sem sair da tela.
    const r = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const below = r.bottom + 8 + h < window.innerHeight;
    tip.style.left = left + "px";
    tip.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - h - 8)) + "px";
  }

  document.addEventListener(
    "click",
    (event) => {
      const btn = event.target.closest("button.gloss");
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        if (owner === btn) close();
        else open(btn);
      } else if (!tip.contains(event.target)) close();
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tip.hidden) {
      const btn = owner;
      close();
      btn?.focus();
    }
  });
  window.addEventListener("scroll", close, { passive: true });
  window.addEventListener("resize", close);
  window.addEventListener("hashchange", close);

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorate);
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  decorate();
}
