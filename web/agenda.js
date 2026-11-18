// Agenda com impacto: os eventos que movem juros, câmbio e bolsa, com o número anterior,
// o que o mercado espera (quando há base nos dados da plataforma) e o que muda se vier
// acima ou abaixo. Datas conferidas nas fontes oficiais em 18/11/2026; horários com fuso,
// mostrados no horário deste dispositivo.
import { flag } from "./symbols.js";
import { cachedFetch } from "./data.js";
import { esc, nf } from "./format.js";

export const CHECKED = "18/11/2026";

const IBGE = ["IBGE", "https://www.ibge.gov.br/calendario/conjunturais.html"];
const BLS = ["BLS", "https://www.bls.gov/schedule/2026/12_sched.htm"];
const BCB = ["Banco Central", "https://www.bcb.gov.br/acessoinformacao/calendariobc?agenda=Reuni%C3%B5es+do+Copom"];
const FED = ["Federal Reserve", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"];
const ECB = ["BCE", "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"];
const FOCUS = ["Banco Central", "https://www.bcb.gov.br/publicacoes/focus"];

// O que muda, por tipo de evento.
const IMPACT = {
  inflacao: {
    up: "Reforça juros altos por mais tempo: juros futuros sobem e o corte da Selic fica mais distante.",
    down: "Abre espaço para o Banco Central cortar juros: juros futuros caem e a bolsa tende a reagir bem.",
  },
  pib: {
    up: "Economia mais forte que o esperado: menos espaço para cortes e lucros das empresas mais firmes.",
    down: "Reforça a desaceleração: aumenta a aposta em cortes da Selic.",
  },
  emprego: {
    up: "Desemprego mais alto que o esperado: alivia a pressão de salários e da inflação de serviços.",
    down: "Mercado de trabalho apertado: salários e inflação de serviços pressionados, juros altos por mais tempo.",
  },
  atividade: {
    up: "Atividade mais forte: sustenta o PIB do trimestre e reduz a aposta em cortes.",
    down: "Atividade mais fraca: reforça a desaceleração e a aposta em cortes de juros.",
  },
  copom: {
    up: "Alta ou tom duro: crédito mais caro, real tende a ganhar força, bolsa sofre.",
    down: "Corte ou sinal de corte: crédito mais barato, bolsa tende a subir, real pode perder força.",
  },
  fomc: {
    up: "Fed mais duro que o esperado: dólar ganha força no mundo e emergentes como o Brasil sofrem.",
    down: "Fed corta ou sinaliza cortes: dólar enfraquece e o fluxo para emergentes melhora.",
  },
  bce: {
    up: "BCE mais duro: euro tende a se fortalecer.",
    down: "BCE corta ou sinaliza cortes: euro tende a enfraquecer contra o dólar.",
  },
  payroll: {
    up: "Mais empregos que o esperado: Fed adia cortes, Treasuries sobem e o dólar ganha força.",
    down: "Menos empregos que o esperado: aposta em cortes do Fed cresce e o dólar perde força.",
  },
  cpi: {
    up: "Inflação americana acima do esperado: Fed mais duro, dólar forte e pressão sobre emergentes.",
    down: "Inflação americana abaixo do esperado: alívio para juros globais e para o real.",
  },
  focus: {
    up: "Revisões para cima da inflação esperada pressionam o Copom a manter juros altos.",
    down: "Expectativas caindo em direção à meta abrem caminho para cortes.",
  },
};

// [quando (com fuso), país, tipo, título, referência, importância 1–3, fonte, série anterior, destino]
export const EVENTS = [
  ["2026-11-23T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
  ["2026-11-26T09:00:00-03:00", "BRA", "inflacao", "IPCA-15", "prévia de novembro", 2, IBGE, null, "#bussola"],
  ["2026-11-27T09:00:00-03:00", "BRA", "emprego", "PNAD Contínua · desemprego", "ago–out", 2, IBGE, "desocupacao", "#brasil"],
  ["2026-11-30T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
  ["2026-12-02T09:00:00-03:00", "BRA", "pib", "PIB do 3º trimestre", "jul–set, ante o trimestre anterior", 3, IBGE, "pib_trimestre", "#brasil"],
  ["2026-12-03T09:00:00-03:00", "BRA", "atividade", "Produção industrial", "outubro, ante setembro", 2, IBGE, "industria_mes", "#brasil"],
  ["2026-12-04T08:30:00-05:00", "USA", "payroll", "Payroll · emprego nos EUA", "novembro", 3, BLS, null, "#juros"],
  ["2026-12-07T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
  ["2026-12-08T09:00:00-03:00", "BRA", "atividade", "Vendas do varejo", "outubro, ante setembro", 2, IBGE, "varejo_mes", "#brasil"],
  ["2026-12-09T14:00:00-05:00", "USA", "fomc", "Decisão do FOMC", "juros dos EUA", 3, FED, null, "#juros"],
  ["2026-12-09T18:30:00-03:00", "BRA", "copom", "Decisão do Copom", "Selic", 3, BCB, "selic_meta", "#bussola"],
  ["2026-12-10T08:30:00-05:00", "USA", "cpi", "CPI · inflação nos EUA", "novembro", 3, BLS, null, "#juros"],
  ["2026-12-10T09:00:00-03:00", "BRA", "atividade", "Volume de serviços", "outubro, ante setembro", 2, IBGE, "servicos_mes", "#brasil"],
  ["2026-12-11T09:00:00-03:00", "BRA", "inflacao", "IPCA", "novembro", 3, IBGE, "ipca_mes", "#bussola"],
  ["2026-12-14T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
  ["2026-12-17T14:15:00+01:00", "EMU", "bce", "Decisão do BCE", "juros da zona do euro", 3, ECB, null, "#moedas"],
  ["2026-12-21T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
  ["2026-12-28T08:25:00-03:00", "BRA", "focus", "Boletim Focus", "semanal", 1, FOCUS, null, "#focus"],
].map(([when, country, kind, title, ref, weight, source, series, href]) => ({ when, country, kind, title, ref, weight, source, series, href }));

const dayKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const fmtDay = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Inflação mensal que o Focus implica para os meses que faltam no ano.
export function impliedMonthly(monthly, yearMedian, year) {
  const done = monthly.filter(([d]) => d.startsWith(year)).map(([, v]) => Number(v));
  const left = 12 - done.length;
  if (!left || !Number.isFinite(yearMedian)) return null;
  const acc = done.reduce((p, v) => p * (1 + v / 100), 1);
  return (Math.pow((1 + yearMedian / 100) / acc, 1 / left) - 1) * 100;
}

// Anterior e esperado de cada evento, com o que a plataforma já tem.
function numbers(event, macro) {
  const all = [...(macro?.brasil || []), ...(macro?.ibge || [])];
  const s = event.series && all.find((x) => x.id === event.series);
  const out = {};
  if (s?.value != null) {
    const v = Number(s.value);
    const d = Number(s.decimals ?? 2);
    out.previous = nf(d).format(v) + "%" + (s.period ? " (" + s.period + ")" : "");
    if (event.kind === "copom") out.previous = nf(2).format(v) + "%";
  }
  const year = event.when.slice(0, 4);
  const focus = (id) => Number(macro?.focus?.indicators?.find((x) => x.id === id)?.years?.find((y) => y.year === year)?.median);
  if (event.kind === "inflacao" && event.series === "ipca_mes") {
    const ipca = all.find((x) => x.id === "ipca_mes");
    const m = ipca && impliedMonthly(ipca.history || [], focus("focus_ipca"), year);
    if (m != null) out.expected = "≈ " + nf(2).format(m) + "% ao mês, implícito no Focus";
  }
  if (event.kind === "copom" && s?.value != null) {
    const end = focus("focus_selic");
    const now = Number(s.value);
    if (Number.isFinite(end))
      out.expected =
        Math.abs(end - now) < 0.01
          ? "manutenção em " + nf(2).format(now) + "% (Focus para o fim do ano)"
          : (end < now ? "corte" : "alta") + " até " + nf(2).format(end) + "% no fim do ano (Focus)";
  }
  return out;
}

function countdown(date, now) {
  const days = Math.round((new Date(dayKey(date) + "T12:00") - new Date(dayKey(now) + "T12:00")) / 864e5);
  if (date < now) return "divulgado";
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return "em " + days + " dias";
}

function row(event, macro, now) {
  const date = new Date(event.when);
  const n = numbers(event, macro);
  const impact = IMPACT[event.kind];
  const past = date < now;
  const facts =
    (n.previous ? "<span><small>Anterior</small> " + esc(n.previous) + "</span>" : "") +
    (n.expected ? "<span><small>Esperado</small> " + esc(n.expected) + "</span>" : "");
  return (
    '<details class="agItem" data-weight="' + event.weight + '"' + (past ? ' data-past="yes"' : "") + ">" +
    "<summary>" +
    '<time datetime="' + esc(event.when) + '">' + esc(fmtTime.format(date)) + "</time>" +
    flag(event.country) +
    '<span class="agTitle"><b>' + esc(event.title) + "</b><small>" + esc(event.ref) + "</small></span>" +
    '<span class="agWeight" aria-label="Importância ' + event.weight + ' de 3">' + "<i></i>".repeat(event.weight) + "</span>" +
    "</summary>" +
    '<div class="agBody">' +
    (facts ? '<div class="agFacts">' + facts + "</div>" : "") +
    '<div class="agIf"><p data-dir="up"><b>Se vier acima:</b> ' + esc(impact.up) + '</p><p data-dir="down"><b>Se vier abaixo:</b> ' + esc(impact.down) + "</p></div>" +
    '<p class="agLinks"><a href="' + event.href + '">Ver a análise →</a><a href="' + esc(event.source[1]) + '" target="_blank" rel="noreferrer">Calendário · ' + esc(event.source[0]) + " ↗</a></p>" +
    "</div></details>"
  );
}

function days(list, macro, now) {
  const by = new Map();
  for (const e of list) {
    const key = dayKey(new Date(e.when));
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(e);
  }
  return [...by]
    .map(([key, items]) => {
      const date = new Date(items[0].when);
      return (
        '<section class="agDay"><h3>' + esc(fmtDay.format(date).replace(".", "")) + " <small>" + countdown(date, now) + "</small></h3>" +
        items.map((e) => row(e, macro, now)).join("") + "</section>"
      );
    })
    .join("");
}

export function agenda({ week, full, read, save }) {
  let macro = null;
  let filter = read("agendaFilter", "all");

  function upcoming(now) {
    // Eventos de hoje continuam na lista até o fim do dia.
    const today = dayKey(now);
    return EVENTS.filter((e) => dayKey(new Date(e.when)) >= today).sort((a, b) => new Date(a.when) - new Date(b.when));
  }

  function draw() {
    const now = new Date();
    const list = upcoming(now);
    if (week) {
      // Duas semanas à frente, só eventos de peso; se forem poucos, os quatro próximos.
      const limit = new Date(now.getTime() + 14 * 864e5);
      const heavy = list.filter((e) => e.weight > 1);
      const near = heavy.filter((e) => new Date(e.when) <= limit);
      const soon = near.length >= 4 ? near : heavy.slice(0, 4);
      const body = week.querySelector(".agList");
      const next = list.find((e) => e.weight === 3 && new Date(e.when) > now);
      week.querySelector(".agSummary").textContent = next
        ? "Próximo grande evento: " + next.title + ", " + countdown(new Date(next.when), now)
        : "";
      body.innerHTML = soon.length
        ? days(soon, macro, now)
        : '<p class="empty">Nenhum evento de peso à frente nesta edição da agenda. ' + (next ? "O próximo é " + esc(next.title) + ", " + countdown(new Date(next.when), now) + "." : "") + "</p>";
    }
    if (full) {
      for (const chip of full.querySelectorAll("[data-ag-filter]")) chip.setAttribute("aria-pressed", String(chip.dataset.agFilter === filter));
      const shown = list.filter((e) => filter === "all" || (filter === "big" ? e.weight === 3 : e.country === filter));
      full.querySelector(".agList").innerHTML = shown.length ? days(shown, macro, now) : '<p class="empty">Nenhum evento com este filtro até o fim da edição.</p>';
    }
  }

  full?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-ag-filter]");
    if (!chip) return;
    filter = chip.dataset.agFilter;
    save("agendaFilter", filter);
    draw();
  });

  cachedFetch("/api/macro")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      macro = data;
      draw();
    })
    .catch(() => {});
  draw();
  setInterval(draw, 600000);
}

