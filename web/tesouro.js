// O que o mercado precifica: juros nominal e real dos títulos públicos (Tesouro Direto) e a
// inflação implícita entre eles, comparada ao Focus e à meta. Responde se o mercado
// acredita que o Banco Central traz a inflação de volta à meta e que juros ele embute.
import { cachedFetch } from "./data.js";
import { esc, num, failure, fullDay } from "./format.js";
import { target, TOLERANCE } from "./compass.js";

const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => (v == null ? "—" : n2.format(v) + "%");
const pp = (v) => (v == null ? "" : (v > 0 ? "+" : v < 0 ? "−" : "") + n2.format(Math.abs(v)) + " p.p.");
const SERIES = {
  be5: ["Inflação implícita · 5 anos", "tdBe"],
  real5: ["Juro real · 5 anos (IPCA+)", "tdReal"],
  pre1: ["Prefixado · 1 ano", "tdPre"],
};

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

// Média geométrica do Focus de IPCA entre o ano seguinte e o ano anterior ao vencimento.
// Anos além do horizonte do Focus repetem o último ano projetado.
export function focusAverage(focus, fromYear, toYear) {
  if (!focus.length || toYear < fromYear) return null;
  const last = focus.at(-1);
  let acc = 1;
  for (let y = fromYear; y <= toYear; y++) acc *= 1 + (focus.find(([fy]) => fy === y)?.[1] ?? last[1]) / 100;
  return (Math.pow(acc, 1 / (toYear - fromYear + 1)) - 1) * 100;
}

// Rótulos no fim das linhas: afasta os que ficariam um sobre o outro.
function tags(list, x, gap = 12) {
  const sorted = [...list].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + gap);
  return sorted.map((g) => '<text class="cpTag ' + g.cls + '" x="' + x + '" y="' + (g.y + 4).toFixed(1) + '">' + g.text + "</text>").join("");
}

function kpi(label, value, note, toneName = "") {
  return '<div class="cpKpi"' + (toneName ? ' data-tone="' + toneName + '"' : "") + "><span>" + esc(label) + "</span><strong>" + esc(value) + "</strong><small>" + note + "</small></div>";
}

function move(v, upIsBad = true) {
  if (v == null) return "";
  const t = Math.abs(v) < 0.05 ? "" : (v > 0) === upIsBad ? "neg" : "pos";
  return '<b data-tone="' + t + '">' + pp(v) + "</b> em 1 mês";
}

// Inflação implícita até cada vencimento × Focus no mesmo período × meta.
function termChart(implied, focus, observed) {
  const W = 760, H = 250, L = 38, R = 120, T = 14, B = 28;
  const pts = implied.map((p) => {
    const year = Number(p.maturity.slice(0, 4));
    const from = Number(observed.slice(0, 4)) + 1;
    return { ...p, year, focus: focusAverage(focus, from, year - 1) };
  });
  const xs = pts.map((p) => p.years);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const x = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
  const values = pts.flatMap((p) => [p.implied, p.focus]).filter(Number.isFinite);
  const top = Math.ceil(Math.max(...values, target(2030) + TOLERANCE) + 1);
  const y = (v) => T + ((top - v) / top) * (H - T - B);
  let out = '<rect class="cpBand" x="' + L + '" y="' + y(3 + TOLERANCE).toFixed(1) + '" width="' + (W - L - R) + '" height="' + (y(3 - TOLERANCE) - y(3 + TOLERANCE)).toFixed(1) + '"/>' +
    '<path class="cpTarget" d="M' + L + " " + y(3).toFixed(1) + "H" + (W - R) + '"/>';
  for (let v = 0; v <= top; v += 2) out += '<path class="cpGrid" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + v + "%</text>";
  let lastLabel = -Infinity;
  for (const p of pts) {
    if (x(p.years) - lastLabel < 34) continue; // vencimentos muito próximos: um rótulo só
    lastLabel = x(p.years);
    out += '<text class="cpYear" x="' + lastLabel.toFixed(1) + '" y="' + (H - 9) + '">' + p.maturity.slice(0, 4) + "</text>";
  }
  const line = (key) => pts.filter((p) => p[key] != null).map((p, i) => (i ? "L" : "M") + x(p.years).toFixed(1) + " " + y(p[key]).toFixed(1)).join("");
  out += '<path class="cpLine tdFocus cpFuture" d="' + line("focus") + '"/><path class="cpLine tdBe" d="' + line("implied") + '"/>';
  for (const p of pts) {
    out += '<circle class="cpDot tdBe' + (p.estimated ? " tdEst" : "") + '" cx="' + x(p.years).toFixed(1) + '" cy="' + y(p.implied).toFixed(1) + '" r="3.5"><title>Até ' +
      fullDay(p.maturity) + ": " + n2.format(p.implied) + "% ao ano (prefixado " + n2.format(p.pre) + "%, IPCA+ " + n2.format(p.real) + "%" + (p.estimated ? ", IPCA+ estimado" : "") + ")</title></circle>";
    if (p.focus != null) out += '<circle class="cpDot tdFocus" cx="' + x(p.years).toFixed(1) + '" cy="' + y(p.focus).toFixed(1) + '" r="2.5"><title>Focus, média até ' + (p.year - 1) + ": " + n2.format(p.focus) + "%</title></circle>";
  }
  const lastP = pts.at(-1);
  const labels = [{ y: y(lastP.implied), cls: "tdBe", text: "Implícita " + n2.format(lastP.implied) + "%" }, { y: y(3), cls: "cpMeta", text: "meta 3%" }];
  if (lastP.focus != null) labels.push({ y: y(lastP.focus), cls: "tdFocus", text: "Focus " + n2.format(lastP.focus) + "%" });
  out += tags(labels, W - R + 8);
  return '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Inflação implícita até cada vencimento, comparada ao Focus e à meta">' + out + "</svg>";
}

// Dois anos de histórico das três medidas.
function historyChart(history, keys) {
  const W = 760, H = 230, L = 38, R = 120, T = 12, B = 24;
  const rows = history.filter((h) => keys.some((k) => h[k] != null));
  const t = (d) => Date.parse(d + "T00:00:00Z");
  const a = t(rows[0].date), b = t(rows.at(-1).date);
  const x = (d) => L + ((t(d) - a) / (b - a || 1)) * (W - L - R);
  const values = rows.flatMap((r) => keys.map((k) => r[k])).filter(Number.isFinite);
  const lo = Math.max(0, Math.floor(Math.min(...values) - 1));
  const hi = Math.ceil(Math.max(...values) + 1);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  let out = "";
  for (let v = lo; v <= hi; v += hi - lo > 8 ? 2 : 1) out += '<path class="cpGrid" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + v + "%</text>";
  let year = null;
  for (const r of rows) {
    const yr = r.date.slice(0, 4);
    if (yr !== year && r.date.slice(5, 7) === "01") out += '<path class="cpGrid" d="M' + x(r.date).toFixed(1) + " " + T + "V" + (H - B) + '"/><text class="cpYear" x="' + x(r.date).toFixed(1) + '" y="' + (H - 7) + '">' + yr + "</text>";
    if (r.date.slice(5, 7) === "01") year = yr;
  }
  const labels = [];
  for (const k of keys) {
    const pts = rows.filter((r) => r[k] != null);
    if (!pts.length) continue;
    out += '<path class="cpLine ' + SERIES[k][1] + '" d="' + pts.map((r, i) => (i ? "L" : "M") + x(r.date).toFixed(1) + " " + y(r[k]).toFixed(1)).join("") + '"/>';
    const last = pts.at(-1);
    labels.push({ y: y(last[k]), cls: SERIES[k][1], text: n2.format(last[k]) + "%" });
  }
  out += tags(labels, W - R + 8);
  return '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Histórico de dois anos da inflação implícita, do juro real e do prefixado">' + out + "</svg>";
}

function titlesTable(titles) {
  const group = (curve, label) => {
    const rows = titles.filter((t) => t.curve === curve);
    return (
      "<tbody><tr><th colspan=\"4\">" + label + "</th></tr>" +
      rows
        .map((t) => {
          const tone = t.month == null || Math.abs(t.month) < 0.05 ? "" : t.month > 0 ? "neg" : "pos";
          return "<tr><td>" + esc(t.name.replace("Tesouro ", "")) + " " + t.maturity.slice(0, 4) + " <small>" + esc(t.code) + "</small></td><td>" + fullDay(t.maturity) + "</td><td>" + pct(t.rate) +
            '</td><td data-tone="' + tone + '">' + (t.month == null ? "—" : pp(t.month)) + "</td></tr>";
        })
        .join("") +
      "</tbody>"
    );
  };
  return '<table class="tdTable"><thead><tr><th>Título</th><th>Vencimento</th><th>Taxa</th><th>Em 1 mês</th></tr></thead>' +
    group("pre", "Prefixados · juro nominal") + group("real", "IPCA+ · juro real acima da inflação") + "</table>";
}

export function marketPricing({ root, read, save }) {
  const tabs = [...root.querySelectorAll("[data-td-view]")];
  let view = ["termo", "historico", "titulos"].includes(read("tdView", "termo")) ? read("tdView", "termo") : "termo";
  let state = null;

  function draw() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.tdView === view));
    if (!state) return;
    const { d, fIpca } = state;
    const plot = root.querySelector(".tdPlot");
    const legend = root.querySelector(".tdLegend");
    if (view === "termo") {
      plot.innerHTML = termChart(d.implied, fIpca, d.observed);
      legend.innerHTML =
        '<span><i class="cpKey tdBe"></i>Inflação implícita média ao ano até o vencimento</span><span><i class="cpKey cpDash"></i>Focus no mesmo período</span>' +
        '<span><i class="cpKey cpBandKey"></i>Meta de 3% e intervalo de tolerância</span>' +
        (d.implied.some((p) => p.estimated) ? "<span>Ponto vazado: IPCA+ estimado (vencimento antes do primeiro IPCA+)</span>" : "");
    } else if (view === "historico") {
      plot.innerHTML = historyChart(d.history, ["pre1", "real5", "be5"]);
      legend.innerHTML = Object.entries(SERIES).map(([, [label, cls]]) => '<span><i class="cpKey ' + cls + '"></i>' + esc(label) + "</span>").join("") + "<span>Prazos constantes, interpolados entre os vencimentos</span>";
    } else {
      plot.innerHTML = titlesTable(d.titles);
      legend.innerHTML = "<span>Taxa média entre compra e venda no Tesouro Direto. Vermelho: taxa subiu (título desvalorizou).</span>";
    }
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.tdView;
      save("tdView", view);
      draw();
    });

  async function load() {
    try {
      const [td, macro, focus] = await Promise.all([json("/api/tesouro"), json("/api/macro"), json("/api/macro/focus")]);
      const d = td.data;
      if (!d) {
        root.querySelector(".tdPlot").innerHTML = td.status === "Coletando" || td.status === "Aguardando coleta"
          ? '<p class="empty">Baixando as taxas do Tesouro Direto…</p>'
          : failure("as taxas do Tesouro Direto", "O arquivo do Tesouro Transparente não respondeu; nova tentativa em 1 hora.");
        if (!d) setTimeout(load, 20000);
        return;
      }
      const fIpca = (focus.indicators.find((i) => i.id === "focus_ipca")?.years || []).map((y) => [Number(y.year), num(y.median)]);
      const fSelic = (focus.indicators.find((i) => i.id === "focus_selic")?.years || []).map((y) => [Number(y.year), num(y.median)]);
      const selic = num(macro.brasil.find((s) => s.id === "selic_meta")?.value);
      const year = Number(d.observed.slice(0, 4));
      const now = d.now, ch = d.changes;
      const focus5 = focusAverage(fIpca, year + 1, year + 5);
      const ceiling = 3 + TOLERANCE;
      const gap = now.be5 == null ? null : now.be5 - 3;
      const nextSelic = fSelic.find(([y]) => y === year + 1);
      state = { d, fIpca };

      root.querySelector(".cpKpis").innerHTML =
        kpi("Inflação implícita · 5 anos", pct(now.be5), move(ch.be5.month) + (focus5 != null ? "<br>Focus no período: " + pct(focus5) : ""), now.be5 > ceiling ? "neg" : "") +
        kpi("Juro real · 5 anos", pct(now.real5), move(ch.real5.month) + "<br>IPCA+ acima da inflação") +
        kpi("Prefixado · 1 ano", pct(now.pre1), move(ch.pre1.month) + (selic != null ? "<br>Selic hoje: " + pct(selic) : "")) +
        kpi("Distância da meta", gap == null ? "—" : pp(gap), now.be5 > ceiling ? '<b data-tone="neg">acima do teto</b> de ' + pct(ceiling) + " nos próximos 5 anos" : "inflação implícita dentro do intervalo", now.be5 > ceiling ? "neg" : "pos");

      const premium = now.be5 != null && focus5 != null ? now.be5 - focus5 : null;
      const selicSignal = now.pre1 != null && selic != null ? now.pre1 - selic : null;
      root.querySelector(".cpRead").innerHTML =
        "Os títulos públicos embutem inflação de <b>" + pct(now.be5) + "</b> ao ano nos próximos 5 anos" +
        (focus5 != null ? ", " + (premium > 0.25 ? "<b>" + n2.format(premium) + " p.p. acima</b> do que o Focus projeta" : premium < -0.25 ? "<b>" + n2.format(-premium) + " p.p. abaixo</b> do Focus" : "em linha com o Focus") + " (" + pct(focus5) + ")" : "") +
        " e " + (now.be5 > ceiling ? "<b>acima do teto da meta</b>" : now.be5 > 3 ? "acima do centro da meta" : "dentro da meta") + ". " +
        "O juro real de 5 anos está em <b>" + pct(now.real5) + "</b>" + (ch.real5.month ? " (" + pp(ch.real5.month) + " em um mês)" : "") + ". " +
        (selicSignal == null ? "" : "O prefixado de 1 ano paga <b>" + pct(now.pre1) + "</b>, " +
          (selicSignal > 0.25 ? "acima da Selic de " + pct(selic) + ": o mercado embute <b>alta de juros</b> ou prêmio de risco" : selicSignal < -0.25 ? "abaixo da Selic de " + pct(selic) + ": o mercado embute <b>cortes</b>" : "perto da Selic de " + pct(selic)) +
          (nextSelic ? " (o Focus vê a Selic em " + pct(nextSelic[1]) + " no fim de " + nextSelic[0] + ")." : "."));
      root.querySelector(".tdStamp").textContent = "Taxas de " + fullDay(d.observed) + " · comparação com " + (d.month_ago ? fullDay(d.month_ago) : "—");
      draw();
    } catch {
      root.querySelector(".tdPlot").innerHTML = failure("as taxas do Tesouro Direto");
    }
  }
  draw();
  load();
  setInterval(load, 1800000);
}
