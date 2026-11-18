// Pré e pós-mercado: o roteiro de quem vai operar ou analisar o pregão brasileiro.
// Antes da abertura mostra como o mundo chega (futuros dos EUA, Brasil em Nova York,
// commodities, dólar e juros) e a agenda do dia; depois do fechamento, o balanço do
// pregão, com o volume e a origem do dinheiro quando a planilha da B3 foi importada.
// Cotações ao vivo vêm de widgets do TradingView (uso provisório, ver tv-widget.js);
// o roteiro usa só dados da própria plataforma.
import { MARKETS, session } from "./indices.js";
import { EVENTS } from "./agenda.js";
import { scoreboard, zone } from "./risk.js";
import { tvTheme, tvWidget, whenVisible } from "./tv-widget.js";
import { flag, round } from "./symbols.js";
import { brl, digest, monthName, shortDay } from "./pregao.js";
import { cachedFetch } from "./data.js";

const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + nf(d).format(Math.abs(v));
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const span = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min";
};

// Painéis de cotações por momento do dia.
const BOARDS = {
  pre: [
    ["Futuros EUA", [["FOREXCOM:SPXUSD", "S&P 500 · contrato"], ["FOREXCOM:NSXUSD", "Nasdaq 100 · contrato"], ["FOREXCOM:DJI", "Dow Jones · contrato"], ["CAPITALCOM:VIX", "VIX · volatilidade"]]],
    ["Brasil em NY", [["AMEX:EWZ", "EWZ · ETF de Brasil"], ["NYSE:PBR", "Petrobras ADR"], ["NYSE:VALE", "Vale ADR"], ["NYSE:ITUB", "Itaú ADR"], ["NYSE:BBD", "Bradesco ADR"], ["NYSE:NU", "Nubank"]]],
    ["Commodities", [["TVC:UKOIL", "Petróleo Brent"], ["TVC:USOIL", "Petróleo WTI"], ["TVC:GOLD", "Ouro"], ["CAPITALCOM:COPPER", "Cobre"]]],
    ["Dólar e juros", [["CAPITALCOM:DXY", "DXY · dólar global"], ["FX_IDC:USDBRL", "Dólar em reais"], ["TVC:US10Y", "Treasury 10 anos"], ["TVC:US02Y", "Treasury 2 anos"]]],
  ],
  post: [
    ["Brasil", [["BMFBOVESPA:IBOV", "Ibovespa"], ["BMFBOVESPA:SMLL", "Small caps"], ["BMFBOVESPA:IFIX", "Fundos imobiliários"], ["FX_IDC:USDBRL", "Dólar em reais"]]],
    ["Brasil em NY", [["AMEX:EWZ", "EWZ · ETF de Brasil"], ["NYSE:PBR", "Petrobras ADR"], ["NYSE:VALE", "Vale ADR"], ["NYSE:ITUB", "Itaú ADR"], ["NYSE:BBD", "Bradesco ADR"], ["NYSE:NU", "Nubank"]]],
    ["EUA", [["FOREXCOM:SPXUSD", "S&P 500 · contrato"], ["FOREXCOM:NSXUSD", "Nasdaq 100 · contrato"], ["CAPITALCOM:VIX", "VIX · volatilidade"], ["TVC:US10Y", "Treasury 10 anos"]]],
    ["Commodities", [["TVC:UKOIL", "Petróleo Brent"], ["TVC:GOLD", "Ouro"], ["CAPITALCOM:COPPER", "Cobre"]]],
  ],
};
BOARDS.live = [BOARDS.post[0], BOARDS.pre[0], BOARDS.pre[1], BOARDS.pre[2]];

const MODES = {
  pre: ["Antes da abertura", "Como o mundo chega ao pregão brasileiro"],
  live: ["Pregão aberto", "O que move a bolsa agora"],
  post: ["Depois do fechamento", "Balanço do pregão e o que vem amanhã"],
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

export function prePost({ root, read, save }) {
  const host = root.querySelector("#ppHost");
  const side = root.querySelector(".ppSide");
  const tabs = [...root.querySelectorAll("[data-pp]")];
  const head = root.querySelector(".ppMode");
  let auto = moment();
  let mode = read("ppMode", "auto");
  let shown = null;
  let data = {};

  const current = () => (mode === "auto" ? auto : mode);
  const isVisible = whenVisible(host, () => mount());

  function mount() {
    const m = current();
    const key = m + "|" + tvTheme();
    if (!isVisible() || shown === key) return;
    shown = key;
    tvWidget(host, {
      kind: "market-overview",
      title: MODES[m][0],
      onFail: () => (shown = null),
      config: {
        dateRange: "1D",
        showChart: true,
        isTransparent: false,
        showSymbolLogo: true,
        showFloatingTooltip: true,
        largeChartUrl: "",
        tabs: BOARDS[m].map(([title, symbols]) => ({ title, symbols: symbols.map(([s, d]) => ({ s, d })) })),
      },
    });
  }

  function draw() {
    const now = new Date();
    auto = moment(now);
    const m = current();
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.pp === mode || (mode === "auto" && t.dataset.pp === "auto")));
    head.innerHTML = "<b>" + esc(MODES[m][0]) + "</b><span>" + esc(MODES[m][1]) + (mode === "auto" ? " · automático pelo horário da B3" : "") + "</span>";
    const b = data.atlas ? scoreboard(data) : null;
    const risk = b?.index != null ? '<p class="ppRisk"><b>' + b.index + "</b> de 100 · " + esc(zone(b.index)) + (b.before != null && b.sameBase !== b.before ? " · " + (b.sameBase > b.before ? "▲" : "▼") + " " + Math.abs(b.sameBase - b.before) + " no mês" : "") + "</p>" : '<p class="ppMuted">Calculando…</p>';
    const blocks =
      m === "post"
        ? [
            block("Pregão B3", b3Block(data.b3), "#pregao"),
            block("Dólar e juros", money(data.macro, data.curve), "#juros"),
            block("Fluxo cambial", flowDay(data.flows), "#fluxo"),
            block("Amanhã e próximos dias", agendaToday(new Date(now.getTime() + 864e5), "Sem divulgações de peso amanhã."), "#agenda"),
            block("Termômetro de risco", risk, "#termometro"),
          ]
        : [
            block("O mundo agora", world(now), "#relogio"),
            block("Agenda de hoje", agendaToday(now), "#agenda"),
            block("Dólar e juros", money(data.macro, data.curve), "#juros"),
            block("Termômetro de risco", risk, "#termometro"),
            block("Fluxo cambial", flowDay(data.flows), "#fluxo"),
          ];
    side.innerHTML = blocks.join("");
    mount();
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      mode = t.dataset.pp;
      save("ppMode", mode);
      draw();
    });

  Promise.all(
    ["/api/atlas?base=USD", "/api/macro/curva", "/api/fluxo", "/api/macro/regional?id=ocde_cli", "/api/macro", "/api/b3"].map((u) => json(u).catch(() => null)),
  ).then(([atlas, curve, flows, cli, macro, b3]) => {
    data = { atlas, curve, flows, cli, macro, b3 };
    draw();
  });
  draw();
  setInterval(draw, 60000);
}
