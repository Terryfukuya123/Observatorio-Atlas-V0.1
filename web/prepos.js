// Bolsas agora: o bloco único de cotações da plataforma, com duas visões.
// Roteiro do pregão: o que olhar antes, durante e depois do pregão da B3 (contratos dos
// EUA, ADRs, Europa e Ásia, pesos do Ibovespa, commodities, dólar e juros), com o roteiro
// lateral montado com dados da própria plataforma (agenda, juros, fluxo, termômetro, B3).
// Bolsas do mundo: índices por região e o estado de cada pregão.
// Cotações vêm de widgets do TradingView, carregados direto no navegador (ver tv-widget.js).
import { MARKETS, REGIONS, describe, session } from "./indices.js";
import { EVENTS } from "./agenda.js";
import { scoreboard, zone } from "./risk.js";
import { tvTheme, tvWidget, whenVisible } from "./tv-widget.js";
import { flag, round } from "./symbols.js";
import { brl, digest, monthName, shortDay } from "./pregao.js";
import { cachedFetch } from "./data.js";
import { esc, nf, tone, dayMonth as day } from "./format.js";

const signed = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + nf(d).format(Math.abs(v));
const fmtTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const span = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min";
};

// Painéis de cotações por momento do dia (Roteiro do pregão).
const SYM = {
  usFut: ["Futuros EUA", [["FOREXCOM:SPXUSD", "S&P 500 · contrato"], ["FOREXCOM:NSXUSD", "Nasdaq 100 · contrato"], ["FOREXCOM:DJI", "Dow Jones · contrato"], ["CAPITALCOM:VIX", "VIX · medo nos EUA"]]],
  adr: ["Brasil em NY", [["AMEX:EWZ", "EWZ · ETF de Brasil"], ["NYSE:PBR", "Petrobras ADR"], ["NYSE:VALE", "Vale ADR"], ["NYSE:ITUB", "Itaú ADR"], ["NYSE:BBD", "Bradesco ADR"], ["NYSE:NU", "Nubank"]]],
  overnight: ["Europa e Ásia", [["INDEX:DEU40", "DAX · Alemanha"], ["INDEX:SX5E", "Euro Stoxx 50"], ["FOREXCOM:UKXGBP", "FTSE 100 · contrato"], ["INDEX:NKY", "Nikkei · Japão"], ["OANDA:HK33HKD", "Hang Seng · contrato"], ["SSE:000300", "CSI 300 · China"]]],
  commod: ["Commodities", [["TVC:UKOIL", "Petróleo Brent"], ["TVC:USOIL", "Petróleo WTI"], ["TVC:GOLD", "Ouro"], ["CAPITALCOM:COPPER", "Cobre"]]],
  money: ["Dólar e juros", [["CAPITALCOM:DXY", "DXY · dólar global"], ["FX_IDC:USDBRL", "Dólar em reais"], ["TVC:US10Y", "Treasury 10 anos"], ["TVC:US02Y", "Treasury 2 anos"]]],
  brasil: ["Brasil", [["BMFBOVESPA:IBOV", "Ibovespa"], ["BMFBOVESPA:SMLL", "Small caps"], ["BMFBOVESPA:IFIX", "Fundos imobiliários"], ["FX_IDC:USDBRL", "Dólar em reais"]]],
  heavy: ["Pesos do Ibovespa", [["BMFBOVESPA:VALE3", "Vale"], ["BMFBOVESPA:PETR4", "Petrobras PN"], ["BMFBOVESPA:ITUB4", "Itaú"], ["BMFBOVESPA:BBDC4", "Bradesco"], ["BMFBOVESPA:BBAS3", "Banco do Brasil"], ["BMFBOVESPA:B3SA3", "B3"]]],
  us: ["EUA", [["FOREXCOM:SPXUSD", "S&P 500 · contrato"], ["FOREXCOM:NSXUSD", "Nasdaq 100 · contrato"], ["CAPITALCOM:VIX", "VIX · medo nos EUA"], ["TVC:US10Y", "Treasury 10 anos"]]],
  asia: ["Ásia abrindo", [["INDEX:NKY", "Nikkei · Japão"], ["OANDA:HK33HKD", "Hang Seng · contrato"], ["SSE:000300", "CSI 300 · China"], ["OANDA:AU200AUD", "ASX 200 · contrato"]]],
};
const BOARDS = {
  pre: [SYM.usFut, SYM.adr, SYM.overnight, SYM.commod, SYM.money],
  live: [SYM.brasil, SYM.heavy, SYM.usFut, SYM.adr, SYM.commod],
  post: [SYM.brasil, SYM.heavy, SYM.adr, SYM.us, SYM.asia, SYM.commod],
};

const MODES = {
  pre: ["Antes da abertura", "A B3 ainda não abriu. Contratos dos EUA, ADRs brasileiros em Nova York, Europa e Ásia, commodities e juros mostram com que humor o mercado deve abrir aqui."],
  live: ["Pregão aberto", "A B3 está negociando. Ibovespa e as ações de maior peso, ao lado do que costuma puxar o índice: Wall Street, ADRs e commodities."],
  post: ["Depois do fechamento", "A B3 fechou. Como o Ibovespa terminou, como os ADRs seguem em Nova York no after-market, a Ásia abrindo e o que vem na agenda."],
};
const WORLD = {
  americas: "Índices das Américas. Com a bolsa aberta o número se mexe; fechada, mostra o último fechamento. Contratos negociam quase 24 horas.",
  europe: "Índices da Europa, que abre entre 4h e 5h de Brasília e fecha no meio da tarde. Bom termômetro para a manhã brasileira.",
  asia: "Índices da Ásia-Pacífico, que negociam durante a noite no Brasil. O fechamento deles chega antes da nossa abertura.",
  refs: "Termômetros globais que afetam todas as bolsas: força do dólar (DXY), medo (VIX), dólar em reais, ouro, petróleo e bitcoin.",
};

// Momento do dia pelo relógio da B3.
export function moment(now = new Date()) {
  const s = session(MARKETS.b3, now);
  if (s.state === "open") return "live";
  // Fechado: se abre ainda hoje (horário de Brasília), é pré-abertura.
  const brt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return s.opensAt && brt.format(s.opensAt) === brt.format(now) ? "pre" : "post";
}

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

function block(title, body, href = "") {
  return '<section class="ppBlock"><h3>' + esc(title) + (href ? ' <a href="' + href + '">→</a>' : "") + "</h3>" + body + "</section>";
}

// O mundo agora: estado de cada região pelos relógios dos pregões.
function world(now) {
  const regions = [
    ["Ásia", ["tse", "hkex", "sse"]],
    ["Europa", ["lse", "xetra", "epa"]],
    ["Nova York", ["nyse"]],
    ["São Paulo", ["b3"]],
  ];
  return (
    '<ul class="ppWorld">' +
    regions
      .map(([name, ids]) => {
        const list = ids.map((id) => [MARKETS[id], session(MARKETS[id], now)]);
        const open = list.filter(([, s]) => s.state !== "closed");
        const next = list.filter(([, s]) => s.state === "closed").sort((a, b) => a[1].wait - b[1].wait)[0];
        const state = open.length ? "open" : "closed";
        const text = open.length
          ? open.length === list.length ? "abertos" : open.length + " de " + list.length + " abertos"
          : next && next[1].wait < 600 ? "abre em " + span(next[1].wait) : "fechado";
        return '<li data-state="' + state + '">' + round(list[0][0].country) + "<b>" + name + "</b><span>" + esc(text) + "</span></li>";
      })
      .join("") +
    "</ul>"
  );
}

function agendaToday(now, empty = "Sem divulgações de peso hoje.") {
  const key = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const today = EVENTS.filter((e) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(e.when)) === key);
  const next = EVENTS.find((e) => new Date(e.when) > now && e.weight === 3);
  const rows = today.map(
    (e) =>
      '<li data-past="' + (new Date(e.when) < now) + '"><time>' + fmtTime.format(new Date(e.when)) + "</time>" + flag(e.country) + "<span>" + esc(e.title) + "</span></li>",
  );
  return (
    (rows.length ? '<ul class="ppEvents">' + rows.join("") + "</ul>" : '<p class="ppMuted">' + esc(empty) + "</p>") +
    (next ? '<p class="ppMuted">Próximo grande evento: <b>' + esc(next.title) + "</b>, " + esc(new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(next.when)).replace(".", "")) + ".</p>" : "")
  );
}

function money(macro, curve) {
  const rows = [];
  const p = macro?.ptax?.USD;
  if (p?.value) rows.push(["Dólar PTAX", "R$ " + nf(4).format(Number(p.value)), p.change_percent == null ? "" : signed(Number(p.change_percent)) + "% · " + day(p.observed), tone(Number(p.change_percent))]);
  const ten = curve?.history?.["10A"];
  if (ten?.length > 1) {
    const d = Number(ten.at(-1)[1]) - Number(ten.at(-2)[1]);
    rows.push(["Treasury 10 anos", nf(2).format(Number(ten.at(-1)[1])) + "%", signed(d) + " p.p. · " + day(ten.at(-1)[0]), tone(-d)]);
  }
  const spread = curve?.spread_history?.["10A-2A"];
  if (spread?.length) rows.push(["Curva 10A − 2A", signed(Number(spread.at(-1)[1])) + " p.p.", Number(spread.at(-1)[1]) < 0 ? "invertida" : "positiva", Number(spread.at(-1)[1]) < 0 ? "neg" : "flat"]);
  return rows.length
    ? '<dl class="ppNums">' + rows.map(([k, v, s, t]) => "<div><dt>" + esc(k) + "</dt><dd><b>" + esc(v) + '</b><small data-tone="' + t + '">' + esc(s) + "</small></dd></div>").join("") + "</dl>"
    : '<p class="ppMuted">Sem dados agora.</p>';
}

function flowDay(flows) {
  const days = flows?.data?.days;
  if (!days?.length) return '<p class="ppMuted">Sem dados agora.</p>';
  const last = days.at(-1);
  const week = days.slice(-5).reduce((s, d) => s + Number(d.total), 0);
  return (
    '<dl class="ppNums"><div><dt>Último dia · ' + day(last.date) + "</dt><dd><b>" + signed(Number(last.total) / 1000, 2) + ' US$ bi</b><small data-tone="' + tone(Number(last.financeiro)) + '">financeiro ' + signed(Number(last.financeiro) / 1000, 2) + "</small></dd></div>" +
    "<div><dt>Últimos 5 dias</dt><dd><b>" + signed(week / 1000, 2) + ' US$ bi</b><small data-tone="' + tone(week) + '">' + (week >= 0 ? "entrada líquida" : "saída líquida") + "</small></dd></div></dl>" +
    '<p class="ppMuted">Câmbio contratado (BCB), divulgado com cerca de uma semana de defasagem.</p>'
  );
}

// Pregão da B3: volume e origem, a partir da planilha importada.
function b3Block(b3) {
  const d = b3?.data;
  if (!d) {
    return (
      '<div class="ppPending"><b>Volume e origem do pregão</b><p>Aguardando a importação da planilha <i>Dados de Mercado</i> da B3. ' +
      "A B3 publica o volume em D+1 e a participação por investidor em D+2, e não permite coleta automática. A planilha é baixada à mão e importada na plataforma.</p></div>"
    );
  }
  const g = digest(d);
  const rows = [];
  if (g.lastVolume) rows.push(["Volume · " + shortDay(g.lastVolume.to), brl(g.lastVolume.total), "média do mês " + brl(g.avg), "flat"]);
  else if (g.avg) rows.push(["Volume médio · " + monthName(g.volMonth), brl(g.avg), "por pregão, até " + shortDay(g.volCut), "flat"]);
  const f = g.lastForeign || g.foreign;
  if (f) rows.push(["Estrangeiros · " + (g.lastForeign ? shortDay(g.lastForeign.to) : "no mês"), brl(f.balance, true), (f.balance >= 0 ? "compra" : "venda") + " líquida até " + shortDay(g.lastForeign?.to || g.invCut), tone(f.balance)]);
  if (g.share) rows.push(["Fatia estrangeira", nf(1).format(g.share.foreign) + "%", "do volume em " + monthName(g.invMonth), "flat"]);
  return (
    '<dl class="ppNums">' + rows.map(([k, v, s, t]) => "<div><dt>" + esc(k) + "</dt><dd><b>" + esc(v) + '</b><small data-tone="' + t + '">' + esc(s) + "</small></dd></div>").join("") + "</dl>" +
    '<p class="ppMuted">B3 · licença de exibição pendente.</p>'
  );
}

// Bolsas agora: duas visões no mesmo bloco. "Roteiro do pregão" segue o relógio da B3
// (antes, durante e depois); "Bolsas do mundo" mostra os índices por região.
export function bolsas({ root, read, save }) {
  const host = root.querySelector("#bsHost");
  const side = root.querySelector(".bsSide");
  const explain = root.querySelector(".bsExplain");
  const clockLine = root.querySelector(".bsClock");
  const views = [...root.querySelectorAll("[data-view]")];
  const moments = [...root.querySelectorAll("[data-moment]")];
  const regions = [...root.querySelectorAll("[data-region]")];
  const filters = [...root.querySelectorAll("[data-for]")];
  let view = read("bsView", "roteiro") === "mundo" ? "mundo" : "roteiro";
  let mode = ["auto", "pre", "live", "post"].includes(read("ppMode", "auto")) ? read("ppMode", "auto") : "auto";
  let region = REGIONS[read("indicesRegion", "americas")] ? read("indicesRegion", "americas") : "americas";
  let auto = moment();
  let shown = null;
  let data = {};

  const current = () => (mode === "auto" ? auto : mode);
  const isVisible = whenVisible(host, () => mount());

  function mount() {
    const key = view + "|" + (view === "mundo" ? region : current()) + "|" + tvTheme();
    if (!isVisible() || shown === key) return;
    shown = key;
    const tabs =
      view === "mundo"
        ? [{ title: REGIONS[region].label, symbols: REGIONS[region].symbols.map(([s, d]) => ({ s, d })) }]
        : BOARDS[current()].map(([title, symbols]) => ({ title, symbols: symbols.map(([s, d]) => ({ s, d })) }));
    host.setAttribute("aria-label", view === "mundo" ? "Índices de " + REGIONS[region].label : "Cotações · " + MODES[current()][0]);
    tvWidget(host, {
      kind: "market-overview",
      title: view === "mundo" ? "Índices · " + REGIONS[region].label : MODES[current()][0],
      onFail: () => (shown = null),
      config: { dateRange: "1D", showChart: true, isTransparent: false, showSymbolLogo: true, showFloatingTooltip: true, largeChartUrl: "", tabs },
    });
  }

  // Linha do topo: estado da B3 agora.
  function b3Clock(now) {
    const s = session(MARKETS.b3, now);
    const [, detail] = describe(s, now);
    const state = { open: "aberta", lunch: "em intervalo" }[s.state] || "fechada";
    return '<b class="dot" data-state="' + s.state + '"></b>B3 ' + state + " · " + esc(detail);
  }

  function sessionsList(now) {
    const list = REGIONS[region].markets.map((id) => [MARKETS[id], session(MARKETS[id], now)]);
    const open = list.filter(([, s]) => s.state === "open").length;
    const rows = list.map(([m, s]) => {
      const [label, detail] = describe(s, now);
      return (
        '<li data-state="' + s.state + '"><b class="dot"></b>' + round(m.country) + "<span><strong>" + esc(m.name) + "</strong><small>" +
        esc(m.venue) + " · " + esc(s.local) + ' local</small></span><span class="sessionState"><em>' + label + "</em><small>" + esc(detail) + "</small></span></li>"
      );
    });
    return '<div class="sessions bsSessions"><p class="ppMuted">' + (open ? open + " de " + list.length + " abertas" : "Todas fechadas") + "</p><ul>" + rows.join("") + "</ul></div>";
  }

  function riskLine() {
    const b = data.atlas ? scoreboard(data) : null;
    return b?.index != null
      ? '<p class="ppRisk"><b>' + b.index + "</b> de 100 · " + esc(zone(b.index)) +
          (b.before != null && b.sameBase !== b.before ? " · " + (b.sameBase > b.before ? "▲" : "▼") + " " + Math.abs(b.sameBase - b.before) + " no mês" : "") + "</p>"
      : '<p class="ppMuted">Calculando…</p>';
  }

  function draw() {
    const now = new Date();
    auto = moment(now);
    const m = current();
    clockLine.innerHTML = b3Clock(now);
    for (const b of views) b.setAttribute("aria-selected", String(b.dataset.view === view));
    for (const f of filters) f.hidden = f.dataset.for !== view;
    for (const b of moments) b.setAttribute("aria-pressed", String(b.dataset.moment === mode));
    for (const b of regions) b.setAttribute("aria-pressed", String(b.dataset.region === region));
    explain.innerHTML =
      view === "mundo"
        ? "<b>" + esc(REGIONS[region].label) + "</b> " + esc(WORLD[region])
        : "<b>" + esc(MODES[m][0]) + (mode === "auto" ? " · agora" : "") + "</b> " + esc(MODES[m][1]) +
          (mode !== "auto" && mode !== auto
            ? ' <span class="bsFixed">Você escolheu este momento; agora é "' + esc(MODES[auto][0].toLowerCase()) + '". <button type="button" data-back>Voltar para agora</button></span>'
            : "");
    explain.querySelector("[data-back]")?.addEventListener("click", () => {
      mode = "auto";
      save("ppMode", mode);
      draw();
    });
    const blocks =
      view === "mundo"
        ? [
            block("Pregões · " + REGIONS[region].label, sessionsList(now), "#relogio"),
            block("O mundo agora", world(now), "#relogio"),
            block("Dólar e juros", money(data.macro, data.curve), "#juros"),
            block("Termômetro de risco", riskLine(), "#termometro"),
          ]
        : m === "post"
          ? [
              block("Pregão B3", b3Block(data.b3), "#pregao"),
              block("Dólar e juros", money(data.macro, data.curve), "#juros"),
              block("Fluxo cambial", flowDay(data.flows), "#fluxo"),
              block("Agenda de amanhã", agendaToday(new Date(now.getTime() + 864e5), "Sem divulgações de peso amanhã."), "#agenda"),
              block("Termômetro de risco", riskLine(), "#termometro"),
            ]
          : [
              block("O mundo agora", world(now), "#relogio"),
              block("Agenda de hoje", agendaToday(now), "#agenda"),
              block("Dólar e juros", money(data.macro, data.curve), "#juros"),
              block("Termômetro de risco", riskLine(), "#termometro"),
              m === "live" ? block("Pregão B3 · mês", b3Block(data.b3), "#pregao") : block("Fluxo cambial", flowDay(data.flows), "#fluxo"),
            ];
    side.innerHTML = blocks.join("");
    mount();
  }

  const pick = (next) => {
    view = next;
    save("bsView", view);
    draw();
  };
  for (const b of views) b.addEventListener("click", () => pick(b.dataset.view));
  for (const b of moments)
    b.addEventListener("click", () => {
      mode = b.dataset.moment;
      save("ppMode", mode);
      draw();
    });
  for (const b of regions)
    b.addEventListener("click", () => {
      region = b.dataset.region;
      save("indicesRegion", region);
      draw();
    });
  // Endereços antigos continuam valendo: #prepos abre o roteiro; #indices, as bolsas do mundo.
  const fromHash = () => {
    if (location.hash === "#indices" && view !== "mundo") pick("mundo");
    if (location.hash === "#prepos" && view !== "roteiro") pick("roteiro");
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();

  Promise.all(
    ["/api/atlas?base=USD", "/api/macro/curva", "/api/fluxo", "/api/macro/regional?id=ocde_cli", "/api/macro", "/api/b3"].map((u) => json(u).catch(() => null)),
  ).then(([atlas, curve, flows, cli, macro, b3]) => {
    data = { atlas, curve, flows, cli, macro, b3 };
    draw();
  });
  draw();
  setInterval(draw, 30000);
}
