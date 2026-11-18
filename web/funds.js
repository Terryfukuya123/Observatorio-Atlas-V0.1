// Fluxo dos fundos de investimento (CVM, ODbL): captação líquida por categoria no ano,
// mês a mês e dia a dia, e onde está o patrimônio. Valores chegam em R$ milhões.
import { cachedFetch } from "./data.js";

const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ORDER = ["rf", "mm", "ac", "pv", "cb", "ou"];

const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => (v == null ? null : Number(v));
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");
export function brl(millions, signed = true) {
  const v = num(millions);
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const body =
    abs >= 1e6 ? nf1.format(abs / 1e6) + " tri" : abs >= 1000 ? nf1.format(abs / 1000) + " bi" : nf0.format(abs) + " mi";
  return (signed ? (v > 0 ? "+" : v < 0 ? "−" : "") : v < 0 ? "−" : "") + "R$ " + body;
}
const day = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
const shortDay = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const month = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(2, 4);

// Barras empilhadas divergentes: entradas acima de zero, saídas abaixo; ponto = saldo.
function stacked(rows, labelOf, titleOf) {
  const W = 760;
  const H = 240;
  const top = 14;
  const bottom = 30;
  let max = 1;
  for (const r of rows) {
    let up = 0;
    let down = 0;
    for (const k of ORDER) {
      const v = num(r[k]) || 0;
      if (v > 0) up += v;
      else down -= v;
    }
    max = Math.max(max, up, down);
  }
  const scale = (H - top - bottom) / 2 / max;
  const zero = top + (H - top - bottom) / 2;
  const slot = W / rows.length;
  const bw = Math.min(26, slot * 0.6);
  const every = Math.ceil(rows.length / 13);
  const groups = rows
    .map((r, i) => {
      const x = slot * i + (slot - bw) / 2;
      let up = zero;
      let down = zero;
      let net = 0;
      const parts = ORDER.map((k) => {
        const v = num(r[k]) || 0;
        net += v;
        const h = Math.abs(v) * scale;
        if (h < 0.3) return "";
        const y = v > 0 ? (up -= h) : down;
        if (v < 0) down += h;
        return '<rect class="c-' + k + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
          '" height="' + h.toFixed(1) + '"/>';
      }).join("");
      const cx = slot * i + slot / 2;
      return (
        '<g class="flowSlot' + (r.partial ? " partial" : "") + '"><title>' + esc(titleOf(r, net)) + "</title>" +
        '<rect class="hit" x="' + (slot * i).toFixed(1) + '" y="0" width="' + slot.toFixed(1) + '" height="' + H + '"/>' +
        parts + '<circle class="tot" cx="' + cx.toFixed(1) + '" cy="' + (zero - net * scale).toFixed(1) + '" r="3.6"/>' +
        (i % every ? "" : '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '">' + esc(labelOf(r)) + "</text>") + "</g>"
      );
    })
    .join("");
  const cap = brl(max, false).replace("R$ ", "");
  return (
    '<svg class="flowBars fundBars" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Captação líquida dos fundos por categoria">' +
    '<path class="zero" d="M0 ' + zero.toFixed(1) + "H" + W + '"/>' +
    '<text class="axis" x="4" y="' + (top + 2) + '">+' + esc(cap) + '</text><text class="axis" x="4" y="' + (H - bottom) + '">−' +
    esc(cap) + "</text>" + groups + "</svg>"
  );
}

function breakdown(r) {
  return ORDER.filter((k) => num(r[k])).map((k) => NAMES[k] + " " + brl(r[k])).join(" · ");
}
let NAMES = {};

function yearRows(data) {
  const items = ORDER.map((k) => data.ytd.find((i) => i.id === k)).filter(Boolean);
  const max = Math.max(...items.flatMap((i) => [Math.abs(num(i.value)), Math.abs(num(i.previous) || 0)]), 1);
  return (
    '<ul class="flowRows fundRows">' +
    items
      .map((i) => {
        const v = num(i.value);
        const p = num(i.previous);
        return (
          '<li data-tone="' + tone(v) + '"><span class="name"><b class="swatch c-' + i.id + '"></b>' + esc(i.name) +
          '</span><span class="track"><i class="c-' + i.id + '" style-w="' + ((Math.abs(v) / max) * 50).toFixed(1) + '" data-side="' +
          (v < 0 ? "neg" : "pos") + '"></i>' +
          (p == null ? "" : '<u style-x="' + (50 + (p / max) * 50).toFixed(1) + '" title="' + esc(data.year - 1) + '"></u>') +
          "</span><b>" + esc(brl(i.value)) + "</b><small>" + (p == null ? "" : esc(data.year - 1) + ": " + esc(brl(i.previous))) +
          "</small></li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function equityBar(equity) {
  const items = ORDER.map((k) => equity.items.find((i) => i.id === k)).filter((i) => i && num(i.value) > 0);
  const total = items.reduce((s, i) => s + num(i.value), 0) || 1;
  let x = 0;
  const rects = items
    .map((i) => {
      const w = (num(i.value) / total) * 1000;
      const out = '<rect class="c-' + i.id + '" x="' + x.toFixed(1) + '" y="0" width="' + Math.max(w - 2, 0).toFixed(1) +
        '" height="34" rx="3"><title>' + esc(i.name + " · " + brl(i.value, false) + " · " + nf1.format((num(i.value) / total) * 100) + "%") +
        "</title></rect>";
      x += w;
      return out;
    })
    .join("");
  return (
    '<svg class="fundShare" viewBox="0 0 1000 34" preserveAspectRatio="none" role="img" aria-label="Patrimônio por categoria">' + rects +
    "</svg><ul class=\"fundShareList\">" +
    items
      .map((i) => '<li><b class="swatch c-' + i.id + '"></b><span>' + esc(i.name) + "</span><em>" + nf0.format((num(i.value) / total) * 100) +
        "%</em><small>" + esc(brl(i.value, false)) + "</small></li>")
      .join("") +
    "</ul>"
  );
}

function sparkline(history) {
  const values = history.map(([, v]) => num(v));
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((v, i) => (i ? "L" : "M") + ((i / (values.length - 1)) * 100).toFixed(1) + " " + (28 - ((v - min) / span) * 26).toFixed(1))
    .join("");
  return '<svg class="flowSpark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + path + '"/></svg>';
}

function applyGeometry(root) {
  for (const bar of root.querySelectorAll("[style-w]")) {
    bar.style.width = bar.getAttribute("style-w") + "%";
    bar.style[bar.dataset.side === "neg" ? "right" : "left"] = "50%";
    bar.removeAttribute("style-w");
  }
  for (const mark of root.querySelectorAll("[style-x]")) {
    mark.style.left = mark.getAttribute("style-x") + "%";
    mark.removeAttribute("style-x");
  }
}

export function fundFlows({ root, read, save }) {
  const $ = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll("[data-fund-view]")];
  let view = ["year", "month", "day"].includes(read("fundView", "year")) ? read("fundView", "year") : "year";
  let payload = null;

  function draw() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.fundView === view));
    const data = payload?.data;
    if (!data) return;
    const body = $("#fundChart");
    if (view === "year") {
      const total = data.ytd.reduce((s, i) => s + num(i.value), 0);
      body.innerHTML =
        '<p class="fundTotal" data-tone="' + tone(total) + '"><strong>' + esc(brl(total)) + "</strong> de captação líquida em " +
        esc(data.year) + " até " + esc(day(data.through)) + "</p>" + yearRows(data);
      applyGeometry(body);
      const cover = data.coverage || {};
      $("#fundNote").textContent =
        "A marca vertical em cada linha indica o mesmo período do ano anterior." +
        (cover[data.year - 1] != null
          ? " Cobertura do cadastro: " + nf1.format(cover[data.year]) + "% das linhas em " + data.year + " e " +
            nf1.format(cover[data.year - 1]) + "% em " + (data.year - 1) + " (classes encerradas saem do cadastro atual)."
          : "");
      return;
    }
    const rows = view === "month" ? data.months : data.days;
    body.innerHTML =
      view === "month"
        ? stacked(rows, (r) => month(r.month), (r, net) => month(r.month) + (r.partial ? " (parcial)" : "") + " · saldo " + brl(net) + " · " + breakdown(r))
        : stacked(rows, (r) => shortDay(r.date), (r, net) => day(r.date) + " · saldo " + brl(net) + " · " + breakdown(r));
    $("#fundNote").textContent =
      view === "month"
        ? "Soma mensal de captação menos resgate. O mês corrente vai até " + day(data.through) + "."
        : "Últimos " + rows.length + " dias com cobertura completa dos informes.";
  }

  function render(p) {
    payload = p;
    NAMES = p.categories || {};
    const data = p.data;
    if (!data) {
      $("#fundChart").innerHTML = '<p class="empty">' + (p.collecting ? "Coletando informes da CVM… a primeira carga leva alguns minutos." : "Informes indisponíveis no momento.") + "</p>";
      if (p.collecting) setTimeout(load, 15000);
      return;
    }
    $("#fundStamp").textContent =
      "Informe diário até " + day(data.through) + " · " + nf0.format(data.classes) + " classes" +
      (data.pending.length ? " · " + data.pending.length + " dia(s) seguinte(s) ainda incompleto(s)" : "");
    $("#fundEquity").innerHTML =
      '<p class="fundEquityTotal"><strong>' + esc(brl(data.equity.total, false)) + "</strong> em " + esc(day(data.equity.date)) + "</p>" +
      sparkline(data.equity.history) + equityBar(data.equity);
    draw();
    if (p.collecting) setTimeout(load, 30000);
  }

  async function load() {
    try {
      const response = await cachedFetch("/api/fundos");
      if (!response.ok) throw Error();
      render(await response.json());
    } catch {
      if (!payload) $("#fundChart").innerHTML = '<p class="empty">Informes indisponíveis no momento.</p>';
    }
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.fundView;
      save("fundView", view);
      draw();
    });
  load();
  setInterval(load, 3600000);
}
