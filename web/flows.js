// Fluxo de capital no Brasil (BCB, ODbL): acumulado no ano, mês a mês, dia a dia,
// quem moveu o dinheiro, onde os estrangeiros aplicaram e atuações do BC no câmbio.
import { cachedFetch } from "./data.js";

const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => (v == null ? null : Number(v));
const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
// Valores chegam em US$ milhões.
export function usd(millions, signed = true) {
  const v = num(millions);
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const body = abs >= 1000 ? nf1.format(abs / 1000) + " bi" : nf0.format(abs) + " mi";
  return (signed ? sign(v) : v < 0 ? "−" : "") + "US$ " + body;
}
const day = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
const shortDay = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const month = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(2, 4);
const longMonth = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(0, 4);
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");

function kpi(title, value, lines, extra = "") {
  const v = num(value);
  return (
    '<article class="flowKpi card" data-tone="' + tone(v) + '"><h3>' + esc(title) + "</h3><strong>" + esc(usd(value)) +
    "</strong><small>" + esc(v > 0 ? "entrada líquida" : v < 0 ? "saída líquida" : "equilíbrio") + "</small>" +
    lines.map((l) => "<p>" + l + "</p>").join("") + extra + "</article>"
  );
}

function versus(item, year) {
  if (!item || item.previous == null) return "";
  const diff = num(item.value) - num(item.previous);
  return (
    "Mesmo período de " + (year - 1) + ": <b>" + esc(usd(item.previous)) + '</b> <span class="flowDiff" data-tone="' +
    tone(diff) + '">' + (diff >= 0 ? "▲" : "▼") + " " + esc(usd(Math.abs(diff), false)) + "</span>"
  );
}

function sparkline(points) {
  const values = points.map(([, v]) => num(v));
  if (values.length < 2) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * 100;
  const y = (v) => 28 - ((v - min) / span) * 26;
  const line = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
  return (
    '<svg class="flowSpark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="zero" d="M0 ' +
    y(0).toFixed(1) + 'H100"/><path d="' + line + '"/></svg>'
  );
}

// Barras divergentes: comercial e financeiro lado a lado, total como marcador.
function bars(rows, labelOf, titleOf) {
  const W = 760;
  const H = 230;
  const top = 14;
  const bottom = 30;
  const values = rows.flatMap((r) => [num(r.comercial), num(r.financeiro), num(r.total)]).filter((v) => v != null);
  const max = Math.max(...values.map(Math.abs), 1);
  const scale = (H - top - bottom) / 2 / max;
  const zero = top + (H - top - bottom) / 2;
  const slot = W / rows.length;
  const bw = Math.min(14, slot * 0.3);
  const rect = (v, x, cls) => {
    if (v == null) return "";
    const h = Math.abs(v) * scale;
    return '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + (v >= 0 ? zero - h : zero).toFixed(1) +
      '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 0.5).toFixed(1) + '" rx="2"/>';
  };
  const every = Math.ceil(rows.length / 13);
  const groups = rows
    .map((r, i) => {
      const cx = slot * i + slot / 2;
      const total = num(r.total);
      const ty = total == null ? null : zero - total * scale;
      return (
        '<g class="flowSlot' + (r.partial ? " partial" : "") + '"><title>' + esc(titleOf(r)) + "</title>" +
        '<rect class="hit" x="' + (slot * i).toFixed(1) + '" y="0" width="' + slot.toFixed(1) + '" height="' + H + '"/>' +
        rect(num(r.comercial), cx - bw - 1, "com") + rect(num(r.financeiro), cx + 1, "fin") +
        (ty == null ? "" : '<circle class="tot" cx="' + cx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="3.6"/>') +
        (i % every ? "" : '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '">' + esc(labelOf(r)) + "</text>") +
        "</g>"
      );
    })
    .join("");
  return (
    '<svg class="flowBars" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Fluxo comercial, financeiro e total">' +
    '<path class="zero" d="M0 ' + zero.toFixed(1) + "H" + W + '"/>' +
    '<text class="axis" x="4" y="' + (top + 2) + '">+' + esc(usd(max, false).replace("US$ ", "")) + "</text>" +
    '<text class="axis" x="4" y="' + (H - bottom) + '">−' + esc(usd(max, false).replace("US$ ", "")) + "</text>" +
    groups + "</svg>"
  );
}

function rowsBlock(block, year) {
  const items = block?.items || [];
  if (!items.length) return '<p class="empty">Sem dados no momento.</p>';
  const max = Math.max(...items.map((i) => Math.abs(num(i.value))), 1);
  return (
    '<ul class="flowRows">' +
    items
      .map((i) => {
        const v = num(i.value);
        const width = (Math.abs(v) / max) * 50;
        return (
          '<li data-tone="' + tone(v) + '"><span class="name">' + esc(i.name) + '</span><span class="track"><i style-w="' +
          width.toFixed(1) + '"></i></span><b>' + esc(usd(i.value)) + "</b><small>" +
          (i.previous != null ? esc(year - 1) + ": " + esc(usd(i.previous)) : "") + "</small></li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

// A CSP proíbe atributos style; a largura das barras é aplicada via CSSOM.
function widths(root) {
  for (const bar of root.querySelectorAll("[style-w]")) {
    const w = Number(bar.getAttribute("style-w"));
    const negative = bar.closest("li")?.dataset.tone === "neg";
    bar.style.width = w + "%";
    bar.style[negative ? "right" : "left"] = "50%";
    bar.removeAttribute("style-w");
  }
}

export function capitalFlows({ root, read, save }) {
  const $ = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll("[data-flow-view]")];
  let view = read("flowView", "month") === "day" ? "day" : "month";
  let data = null;

  function chart() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.flowView === view));
    if (!data) return;
    const rows = view === "month" ? data.months : data.days;
    $("#flowChart").innerHTML = rows.length
      ? view === "month"
        ? bars(rows, (r) => month(r.month), (r) =>
            longMonth(r.month) + (r.partial ? " (parcial)" : "") + " · total " + usd(r.total) + " · comercial " +
            usd(r.comercial) + " · financeiro " + usd(r.financeiro))
        : bars(rows, (r) => shortDay(r.date), (r) =>
            day(r.date) + " · total " + usd(r.total) + " · comercial " + usd(r.comercial) + " · financeiro " + usd(r.financeiro))
      : '<p class="empty">Sem dados no momento.</p>';
    $("#flowChartNote").textContent =
      view === "month"
        ? "Soma mensal do câmbio contratado. O mês corrente é parcial, até " + day(data.through) + "."
        : "Últimos " + rows.length + " dias úteis divulgados. O BCB publica com cerca de uma semana de defasagem.";
  }

  function render(payload) {
    data = payload.data;
    if (!data) {
      $("#flowKpis").innerHTML = '<p class="empty">Coletando dados do BCB…</p>';
      setTimeout(load, 8000);
      return;
    }
    const y = data.year;
    const t = data.ytd;
    $("#fluxoStamp").textContent = "Câmbio contratado até " + day(data.through) + " · BCB";
    const banks = data.market.banks;
    const inter = data.market.interbank;
    $("#flowKpis").innerHTML =
      kpi("Fluxo cambial total em " + y, t.cambio_total?.value, [versus(t.cambio_total, y)]) +
      kpi("Comercial", t.cambio_comercial?.value, [
        "Exportações " + esc(usd(t.cambio_exportacao?.value, false)) + " · importações " + esc(usd(t.cambio_importacao?.value, false)),
        versus(t.cambio_comercial, y),
      ]) +
      kpi("Financeiro", t.cambio_financeiro?.value, [
        "Compras " + esc(usd(t.cambio_fin_compras?.value, false)) + " · vendas " + esc(usd(t.cambio_fin_vendas?.value, false)),
        versus(t.cambio_financeiro, y),
      ]) +
      (banks
        ? '<article class="flowKpi card" data-tone="' + tone(num(banks.value)) + '"><h3>Posição de câmbio dos bancos</h3><strong>' +
          esc(usd(banks.value)) + "</strong><small>" + (num(banks.value) < 0 ? "vendida em dólar" : "comprada em dólar") + " · " +
          esc(longMonth(banks.observed.slice(0, 7))) + "</small>" + sparkline(banks.history) +
          (inter
            ? "<p>Interbancário: <b>" + esc(usd(inter.value, false)) + "</b> em " + esc(day(inter.observed)) + " · média de 20 dias " +
              esc(usd(inter.average20, false)) + "</p>"
            : "") +
          "</article>"
        : "");
    const agents = data.agents;
    const foreign = data.foreigners;
    const span = (b) => (b?.through ? "jan–" + MONTHS[Number(b.through.slice(5, 7)) - 1] + "/" + b.through.slice(0, 4) : "");
    $("#flowAgentsSpan").textContent = span(agents);
    $("#flowForeignSpan").textContent = span(foreign);
    $("#flowAgents").innerHTML = rowsBlock(agents, y);
    $("#flowForeign").innerHTML = rowsBlock(foreign, y);
    widths(root);
    const bc = data.central_bank;
    $("#flowBC").innerHTML = bc?.items?.length
      ? '<p class="flowBcSpan">' + esc(bc.year) + " até " + esc(day(bc.through)) + "</p><ul class=\"flowBc\">" +
        bc.items
          .map((i) => "<li><span>" + esc(i.instrument) + "<small>" + esc(i.operations) + " leilões</small></span><b>" +
            esc(usd(i.accepted, false)) + "</b></li>")
          .join("") +
        "</ul><h4>Últimos leilões com aceite</h4><ul class=\"flowRecent\">" +
        bc.recent.map((r) => "<li><span>" + esc(day(r.date)) + "</span><span>" + esc(r.instrument) + "</span><b>" +
          esc(usd(r.accepted, false)) + "</b></li>").join("") +
        "</ul>"
      : '<p class="empty">Atuações indisponíveis no momento.</p>';
    $("#flowSources").innerHTML =
      'Fonte: Banco Central do Brasil, <a href="' + esc(payload.dataset) + '" target="_blank" rel="noreferrer">SGS</a> e <a href="' +
      esc(payload.atuacoes_dataset) + '" target="_blank" rel="noreferrer">histórico de atuações no câmbio</a> · ' +
      '<a href="' + esc(payload.license_url) + '" target="_blank" rel="noreferrer">ODbL 1.0</a>. Somas e comparações calculadas pelo Observatório.';
    chart();
  }

  async function load() {
    try {
      const response = await cachedFetch("/api/fluxo");
      if (!response.ok) throw Error();
      render(await response.json());
    } catch {
      if (!data) $("#flowKpis").innerHTML = '<p class="empty">Fluxo indisponível no momento.</p>';
    }
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.flowView;
      save("flowView", view);
      chart();
    });
  load();
  setInterval(load, 1800000);
  return { load };
}
