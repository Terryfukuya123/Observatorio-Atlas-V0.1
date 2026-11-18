// Pulso do dia: os números que abrem a conversa, cada um com uma leitura em uma frase
// e o caminho para a análise completa. Lê as mesmas APIs das seções detalhadas.
import { MARKETS, session } from "./indices.js";
import { flag, pair, round } from "./symbols.js";

const nf = (digits) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const n1 = nf(1);
const n2 = nf(2);
const n4 = nf(4);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => (v == null ? null : Number(v));
const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");
const day = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const monthName = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];

function money(value, unit, scale) {
  const v = num(value) / scale;
  return sign(v) + unit + " " + n1.format(Math.abs(v)) + " bi";
}

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

// Linha simples (valores) ou barras divergentes (bars: true).
function mini(values, bars = false) {
  const v = values.map(num).filter(Number.isFinite);
  if (v.length < 2) return "";
  if (bars) {
    const max = Math.max(...v.map(Math.abs), 1);
    const w = 100 / v.length;
    return (
      '<svg class="pulseMini" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="zero" d="M0 15H100"/>' +
      v.map((x, i) => {
        const h = (Math.abs(x) / max) * 14;
        return '<rect class="' + tone(x) + '" x="' + (i * w + w * 0.15).toFixed(1) + '" y="' + (x > 0 ? 15 - h : 15).toFixed(1) +
          '" width="' + (w * 0.7).toFixed(1) + '" height="' + Math.max(h, 0.6).toFixed(1) + '"/>';
      }).join("") +
      "</svg>"
    );
  }
  const min = Math.min(...v);
  const span = Math.max(...v) - min || 1;
  const d = v.map((x, i) => (i ? "L" : "M") + ((i / (v.length - 1)) * 100).toFixed(1) + " " + (27 - ((x - min) / span) * 24).toFixed(1)).join("");
  return '<svg class="pulseMini" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
}

function tile({ href, label, icon = "", value, delta, deltaTone = "flat", read, chart = "", go }) {
  return (
    '<a class="pulseTile" href="' + href + '"><span class="pulseLabel">' + icon + esc(label) + "</span>" +
    '<strong class="pulseValue">' + esc(value) + "</strong>" +
    (delta ? '<span class="pulseDelta" data-tone="' + deltaTone + '">' + esc(delta) + "</span>" : "") +
    chart + '<span class="pulseRead">' + esc(read) + "</span>" +
    '<span class="pulseGo">' + esc(go) + ' <b aria-hidden="true">→</b></span></a>'
  );
}

const builders = {
  dollar(macro) {
    const p = macro?.ptax?.USD;
    if (!p?.value) return null;
    const hist = p.history || [];
    const first = num(hist[0]?.[1]);
    const year = first ? (num(p.value) / first - 1) * 100 : null;
    const change = num(p.change_percent);
    return tile({
      href: "#fluxo",
      label: "Dólar · PTAX",
      icon: pair("USD", "BRL"),
      value: "R$ " + n4.format(num(p.value)),
      delta: change == null ? "" : sign(change) + n2.format(Math.abs(change)) + "% no dia",
      deltaTone: tone(change),
      chart: mini(hist.slice(-90).map(([, v]) => v)),
      read: year == null ? "Fechamento de " + day(p.observed) : (year >= 0 ? "Real " + n1.format(year) + "% mais fraco" : "Real " + n1.format(-year) + "% mais forte") + " que há um ano",
      go: "O fluxo por trás do câmbio",
    });
  },
  selic(macro) {
    const s = macro?.brasil?.find((x) => x.id === "selic_meta");
    if (!s?.value) return null;
    const hist = s.history || [];
    const start = hist.find(([d]) => d.startsWith(s.observed.slice(0, 4))) || hist[0];
    const moved = start ? num(s.value) - num(start[1]) : 0;
    return tile({
      href: "#brasil",
      label: "Selic meta",
      icon: flag("BRA"),
      value: n2.format(num(s.value)) + "%",
      delta: moved ? sign(moved) + n2.format(Math.abs(moved)) + " p.p. desde " + monthName(start[0]) : "Estável no ano",
      chart: mini(hist.map(([, v]) => v)),
      read: moved < 0 ? "Banco Central em ciclo de corte" : moved > 0 ? "Banco Central em ciclo de alta" : "Juros parados no ano",
      go: "Juros, inflação e atividade",
    });
  },
  inflation(macro) {
    const i = macro?.brasil?.find((x) => x.id === "ipca_12m");
    if (!i?.value) return null;
    const focus = macro?.focus?.indicators?.find((x) => x.id === "focus_ipca")?.years?.find((y) => y.year === i.observed.slice(0, 4));
    const fv = num(focus?.median);
    const fw = num(focus?.week_ago?.median);
    return tile({
      href: "#focus",
      label: "IPCA em 12 meses",
      icon: flag("BRA"),
      value: n2.format(num(i.value)) + "%",
      delta: "até " + monthName(i.observed) + "/" + i.observed.slice(2, 4),
      chart: mini((i.history || []).map(([, v]) => v)),
      read: fv == null ? "Inflação oficial, IBGE" : "Mercado espera " + n2.format(fv) + "% no ano" + (fw && fv !== fw ? (fv < fw ? ", em queda" : ", em alta") : ""),
      go: "Expectativas do Focus",
    });
  },
  flow(flows) {
    const d = flows?.data;
    const t = d?.ytd?.cambio_total;
    if (!t) return null;
    const v = num(t.value);
    const p = num(t.previous);
    return tile({
      href: "#fluxo",
      label: "Fluxo cambial no ano",
      icon: pair("USD", "BRL"),
      value: money(v, "US$", 1000),
      delta: "até " + day(d.through),
      deltaTone: tone(v),
      chart: mini(d.months.map((m) => m.total), true),
      read: p == null ? (v >= 0 ? "Entrou mais dólar do que saiu" : "Saiu mais dólar do que entrou") : "Mesmo período de " + (d.year - 1) + ": " + money(p, "US$", 1000),
      go: "Quem moveu o dinheiro",
    });
  },
  funds(funds) {
    const d = funds?.data;
    if (!d) return null;
    const total = d.ytd.reduce((s, i) => s + num(i.value), 0);
    const leader = [...d.ytd].sort((a, b) => num(b.value) - num(a.value))[0];
    const months = d.months.map((m) => Object.entries(m).filter(([k]) => d.ytd.some((i) => i.id === k)).reduce((s, [, v]) => s + num(v), 0));
    return tile({
      href: "#fundos",
      label: "Fundos no ano",
      icon: flag("BRA"),
      value: money(total, "R$", 1000),
      delta: "captação líquida até " + day(d.through),
      deltaTone: tone(total),
      chart: mini(months, true),
      read: "Destaque: " + leader.name.toLowerCase() + " (" + money(leader.value, "R$", 1000) + ")",
      go: "Para onde foi o dinheiro",
    });
  },
  treasury(curve) {
    const ten = curve?.curve?.find((c) => c.code === "10A");
    if (!ten) return null;
    const spread = num(curve.spreads?.["10A-2A"]);
    return tile({
      href: "#juros",
      label: "Juros EUA · 10 anos",
      icon: flag("USA"),
      value: n2.format(num(ten.value)) + "%",
      delta: spread == null ? "" : "10A − 2A: " + sign(spread) + n2.format(Math.abs(spread)) + " p.p.",
      deltaTone: spread < 0 ? "neg" : "flat",
      chart: mini((curve.history?.["10A"] || []).slice(-120).map(([, v]) => v)),
      read: spread < 0 ? "Curva invertida: sinal de desaceleração" : "Curva positiva: sem sinal de recessão",
      go: "Curva e ciclo global",
    });
  },
  reserves(macro) {
    const r = macro?.brasil?.find((x) => x.id === "reservas");
    if (!r?.value) return null;
    const hist = r.history || [];
    const first = num(hist[0]?.[1]);
    const moved = first ? num(r.value) - first : null;
    return tile({
      href: "#brasil",
      label: "Reservas internacionais",
      icon: flag("BRA"),
      value: "US$ " + n1.format(num(r.value) / 1000) + " bi",
      delta: moved == null ? "" : sign(moved) + "US$ " + n1.format(Math.abs(moved) / 1000) + " bi no período",
      deltaTone: tone(moved),
      chart: mini(hist.map(([, v]) => v)),
      read: "Colchão do país contra choques no câmbio",
      go: "Painel Brasil",
    });
  },
  sessions() {
    const now = new Date();
    const list = Object.values(MARKETS).map((m) => ({ m, s: session(m, now) }));
    const open = list.filter((x) => x.s.state === "open");
    const next = list.filter((x) => x.s.state !== "open").sort((a, b) => a.s.wait - b.s.wait)[0];
    const dots = '<span class="pulseDots" aria-hidden="true">' + list.map((x) => '<i data-state="' + x.s.state + '" title="' + esc(x.m.name) + '">' + round(x.m.country) + "</i>").join("") + "</span>";
    return tile({
      href: "#indices",
      label: "Bolsas abertas agora",
      value: open.length + " de " + list.length,
      delta: open.length ? open.map((x) => x.m.name).slice(0, 3).join(", ") + (open.length > 3 ? "…" : "") : "Todas fechadas",
      deltaTone: open.length ? "pos" : "flat",
      chart: dots,
      read: next ? "Próxima: " + next.m.name + " em " + (next.s.wait >= 60 ? Math.floor(next.s.wait / 60) + "h" : next.s.wait + " min") : "",
      go: "Índices mundiais",
    });
  },
};

// Manchete: os números do pulso numa frase corrida, com o sinal de cada um.
function headline({ macro, flows, funds }) {
  const b = (text, t = "") => "<b" + (t ? ' data-tone="' + t + '"' : "") + ">" + esc(text) + "</b>";
  const parts = [];
  const p = macro?.ptax?.USD;
  const selic = macro?.brasil?.find((x) => x.id === "selic_meta");
  const ipca = macro?.brasil?.find((x) => x.id === "ipca_12m");
  const first = [];
  if (p?.value) {
    const c = num(p.change_percent);
    first.push("dólar a " + b("R$ " + n2.format(num(p.value))) + (c == null ? "" : " (" + b(sign(c) + n2.format(Math.abs(c)) + "%", tone(c)) + ")"));
  }
  if (selic?.value) first.push("Selic em " + b(n2.format(num(selic.value)) + "%"));
  if (ipca?.value) first.push("IPCA de " + b(n2.format(num(ipca.value)) + "%") + " em 12 meses");
  if (first.length) parts.push(first.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".");
  const flow = num(flows?.data?.ytd?.cambio_total?.value);
  const fund = funds?.data ? funds.data.ytd.reduce((s, i) => s + num(i.value), 0) : null;
  const second = [];
  if (flow != null) second.push((flow >= 0 ? "entraram " : "saíram ") + b("US$ " + n1.format(Math.abs(flow) / 1000) + " bi", tone(flow)) + " pelo câmbio");
  if (fund != null) second.push((fund >= 0 ? "os fundos captaram " : "os fundos perderam ") + b("R$ " + n1.format(Math.abs(fund) / 1000) + " bi", tone(fund)));
  if (second.length) parts.push("No ano, " + second.join(" e ") + ".");
  const now = new Date();
  const open = Object.values(MARKETS).filter((m) => session(m, now).state === "open").length;
  parts.push("Agora, " + b(open + " de " + Object.keys(MARKETS).length) + " bolsas estão abertas.");
  return parts.join(" ");
}

export function pulse({ root }) {
  const grid = root.querySelector(".pulseGrid");
  const lead = root.querySelector(".pulseHeadline");
  const stamp = root.querySelector(".pulseStamp");
  let sources = {};

  function draw() {
    const tiles = [
      builders.dollar(sources.macro),
      builders.selic(sources.macro),
      builders.inflation(sources.macro),
      builders.flow(sources.flows),
      builders.funds(sources.funds),
      builders.treasury(sources.curve),
      builders.reserves(sources.macro),
      builders.sessions(),
    ].filter(Boolean);
    grid.innerHTML = tiles.join("") || '<p class="empty">Carregando indicadores…</p>';
    if (lead && sources.macro) lead.innerHTML = headline(sources);
  }

  async function load() {
    const [macro, flows, funds, curve] = await Promise.allSettled(
      ["/api/macro", "/api/fluxo", "/api/fundos", "/api/macro/curva"].map(json),
    );
    sources = { macro: macro.value, flows: flows.value, funds: funds.value, curve: curve.value };
    stamp.textContent = "Atualizado às " + new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    draw();
  }

  draw();
  load();
  setInterval(load, 900000);
  setInterval(draw, 60000); // Pregões mudam de estado ao longo do dia.
}
