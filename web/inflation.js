// Qualidade da inflação: o IPCA por dentro. Núcleos (tendência sem ruído), serviços, livres
// e monitorados, difusão (quantos preços sobem) e commodities em reais (IC-Br), que
// antecipam alimentos e combustíveis. Responde se a inflação está espalhada ou concentrada
// e se o ritmo recente aponta para a meta.
import { cachedFetch } from "./data.js";
import { esc, failure, MONTHS } from "./format.js";
import { TOLERANCE } from "./compass.js";

const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (v, f = n2) => (v == null ? "—" : f.format(v) + "%");
const signed = (v, f = n2) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + f.format(Math.abs(v)) + "%");
const month = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(2, 4);
const TARGET = 3;
const LINES = {
  ipca: ["IPCA cheio", "ifIpca"],
  core_average: ["Média dos 5 núcleos", "ifCore"],
  ipca_servicos: ["Serviços", "ifServ"],
};
const COMMOD = {
  icbr_agro: ["Agropecuária", "ifAgro"],
  icbr_metal: ["Metal", "ifMetal"],
  icbr_energia: ["Energia", "ifEnergy"],
};

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

function kpi(label, value, note, toneName = "") {
  return '<div class="cpKpi"' + (toneName ? ' data-tone="' + toneName + '"' : "") + "><span>" + esc(label) + "</span><strong>" + esc(value) + "</strong><small>" + note + "</small></div>";
}

const vsTarget = (v) => (v == null ? "" : v > TARGET + TOLERANCE ? '<b data-tone="neg">acima do teto</b>' : v > TARGET + 0.25 ? "acima do centro da meta" : v < TARGET - TOLERANCE ? '<b data-tone="neg">abaixo do piso</b>' : '<b data-tone="pos">perto da meta</b>');

function tags(list, x, gap = 20) {
  const sorted = [...list].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + gap);
  return sorted.map((g) => '<text class="cpTag ' + g.cls + '" x="' + x + '" y="' + (g.y + 4).toFixed(1) + '">' + g.text + "</text>").join("");
}

// Linhas mensais ([["2026-10", v], ...]) num mesmo eixo, com faixa da meta opcional.
function lineChart(series, { band = false, label, unit = "%", base = null }) {
  const W = 760, H = 240, L = 40, R = 118, T = 12, B = 24;
  const months = [...new Set(series.flatMap((s) => s.points.map(([m]) => m)))].sort();
  const x = (m) => L + (months.indexOf(m) / Math.max(1, months.length - 1)) * (W - L - R);
  const values = series.flatMap((s) => s.points.map(([, v]) => v)).filter(Number.isFinite);
  if (band) values.push(TARGET + TOLERANCE, TARGET - TOLERANCE);
  if (base != null) values.push(base);
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const y = (v) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B);
  const step = hi - lo > 40 ? 20 : hi - lo > 16 ? 5 : hi - lo > 8 ? 2 : 1;
  let out = "";
  if (band)
    out += '<rect class="cpBand" x="' + L + '" y="' + y(TARGET + TOLERANCE).toFixed(1) + '" width="' + (W - L - R) + '" height="' + (y(TARGET - TOLERANCE) - y(TARGET + TOLERANCE)).toFixed(1) + '"/>' +
      '<path class="cpTarget" d="M' + L + " " + y(TARGET).toFixed(1) + "H" + (W - R) + '"/>';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
    out += '<path class="cpGrid" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + v + (unit === "%" ? "%" : "") + "</text>";
  if (base != null) out += '<path class="cpTarget" d="M' + L + " " + y(base).toFixed(1) + "H" + (W - R) + '"/>';
  for (const m of months) if (m.endsWith("-01")) out += '<text class="cpYear" x="' + x(m).toFixed(1) + '" y="' + (H - 7) + '">' + m.slice(0, 4) + "</text>";
  const labels = [];
  for (const s of series) {
    const pts = s.points.filter(([, v]) => Number.isFinite(v));
    if (!pts.length) continue;
    out += '<path class="cpLine ' + s.cls + '" d="' + pts.map(([m, v], i) => (i ? "L" : "M") + x(m).toFixed(1) + " " + y(v).toFixed(1)).join("") + '"/>';
    const [, v] = pts.at(-1);
    labels.push({ y: y(v), cls: s.cls, text: s.tag(v) });
  }
  if (band) labels.push({ y: y(TARGET), cls: "cpMeta", text: "meta 3%" });
  out += tags(labels, W - R + 8);
  return '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + '">' + out + "</svg>";
}

function diffusionChart(d) {
  const W = 760, H = 220, L = 40, R = 118, T = 12, B = 24;
  const pts = d.history;
  const lo = 30, hi = 80;
  const bw = (W - L - R) / pts.length;
  const y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  let out = "";
  for (let v = lo; v <= hi; v += 10) out += '<path class="cpGrid" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + v + "%</text>";
  pts.forEach(([m, v], i) => {
    const x = L + i * bw;
    out += '<rect class="ifBar' + (v >= 60 ? " ifHigh" : "") + '" x="' + (x + 1).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + (H - B - y(v)).toFixed(1) + '"><title>' + month(m) + ": " + n1.format(v) + "% dos itens subiram</title></rect>";
    if (m.endsWith("-01")) out += '<text class="cpYear" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 7) + '">' + m.slice(0, 4) + "</text>";
  });
  const avg = pts.reduce((a, [, v]) => a + v, 0) / pts.length;
  out += '<path class="cpTarget" d="M' + L + " " + y(avg).toFixed(1) + "H" + (W - R) + '"/>';
  out += tags([{ y: y(avg), cls: "cpMeta", text: "média " + n1.format(avg) + "%" }, { y: y(pts.at(-1)[1]), cls: "ifCore", text: month(pts.at(-1)[0]) + " " + n1.format(pts.at(-1)[1]) + "%" }], W - R + 8);
  return '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Difusão do IPCA nos últimos 36 meses">' + out + "</svg>";
}

function table(d) {
  const rows = [
    ["IPCA cheio", d.ipca],
    ["Média dos 5 núcleos", d.core_average],
    ...Object.values(d.cores).map((c) => ["· " + c.name, c]),
    ...Object.values(d.groups).map((g) => [g.name, g]),
  ].filter(([, r]) => r);
  const cell = (v) => '<td data-tone="' + (v == null || v < TARGET - TOLERANCE ? "" : v > TARGET + TOLERANCE ? "neg" : v <= TARGET + 0.25 ? "pos" : "") + '">' + pct(v) + "</td>";
  return '<table class="tdTable ifTable"><thead><tr><th>Medida</th><th>No mês</th><th>12 meses</th><th>3 meses anualizado</th><th>12 meses, há um ano</th></tr></thead><tbody>' +
    rows.map(([name, r]) => "<tr><td>" + esc(name) + "</td><td>" + pct(r.month) + "</td>" + cell(r.twelve) + cell(r.saar3) + "<td>" + pct(r.twelve_year_ago) + "</td></tr>").join("") +
    "</tbody></table>";
}

export function inflationQuality({ root, read, save }) {
  const tabs = [...root.querySelectorAll("[data-if-view]")];
  let view = ["nucleos", "difusao", "commodities", "tabela"].includes(read("ifView", "nucleos")) ? read("ifView", "nucleos") : "nucleos";
  let d = null;

  function draw() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.ifView === view));
    if (!d) return;
    const plot = root.querySelector(".ifPlot");
    const legend = root.querySelector(".ifLegend");
    if (view === "nucleos") {
      const series = Object.entries(LINES)
        .map(([k, [name, cls]]) => ({ cls, points: (k === "ipca" ? d.ipca : k === "core_average" ? d.core_average : d.groups[k])?.history || [], tag: (v) => n2.format(v) + "%", name }))
        .filter((s) => s.points.length);
      plot.innerHTML = lineChart(series, { band: true, label: "IPCA, média dos núcleos e serviços em 12 meses, com a meta" });
      legend.innerHTML = series.map((s) => '<span><i class="cpKey ' + s.cls + '"></i>' + esc(s.name) + " em 12 meses</span>").join("") + '<span><i class="cpKey cpBandKey"></i>Meta de 3% e intervalo de tolerância</span>';
    } else if (view === "difusao") {
      plot.innerHTML = diffusionChart(d.diffusion);
      legend.innerHTML = "<span>Parcela dos itens do IPCA com alta no mês. Barras destacadas: 60% ou mais. Linha: média do período.</span>";
    } else if (view === "commodities") {
      const series = Object.entries(COMMOD)
        .filter(([k]) => d.commodities[k])
        .map(([k, [name, cls]]) => {
          const h = d.commodities[k].history;
          const first = h[0][1];
          return { cls, name, points: h.map(([m, v]) => [m, (v / first) * 100]), tag: (v) => n1.format(v) };
        });
      plot.innerHTML = lineChart(series, { label: "IC-Br por segmento, base 100 há 36 meses", unit: "", base: 100 });
      legend.innerHTML = series.map((s) => '<span><i class="cpKey ' + s.cls + '"></i>' + esc(s.name) + "</span>").join("") + "<span>Índice de Commodities do BC em reais, base 100 no início do período</span>";
    } else {
      plot.innerHTML = table(d);
      legend.innerHTML = "<span>Verde: entre o piso (1,5%) e pouco acima do centro da meta. Vermelho: acima do teto (4,5%). Ritmo de 3 meses sem ajuste sazonal.</span>";
    }
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.ifView;
      save("ifView", view);
      draw();
    });

  async function load() {
    try {
      const res = await json("/api/inflacao");
      d = res.data;
      if (!d?.core_average || !d?.ipca) {
        root.querySelector(".ifPlot").innerHTML = '<p class="empty">Coletando as séries de inflação do Banco Central…</p>';
        setTimeout(load, 30000);
        return;
      }
      const core = d.core_average, serv = d.groups.ipca_servicos, diff = d.diffusion, ic = d.commodities.icbr;
      const free = d.groups.ipca_livres, adm = d.groups.ipca_monitorados;
      root.querySelector(".cpKpis").innerHTML =
        kpi("Média dos núcleos · 12 meses", pct(core.twelve), "Ritmo de 3 meses: " + pct(core.saar3) + " ao ano, " + vsTarget(core.saar3), core.twelve > TARGET + TOLERANCE ? "neg" : "") +
        kpi("Serviços · 12 meses", serv ? pct(serv.twelve) : "—", serv ? "Ritmo de 3 meses: " + pct(serv.saar3) + " · há um ano: " + pct(serv.twelve_year_ago) : "", serv?.twelve > TARGET + TOLERANCE ? "neg" : "") +
        kpi("Difusão · " + (diff ? month(diff.observed) : ""), diff ? pct(diff.value, n1) : "—",
          diff?.seasonal != null ? "dos itens subiram; " + (diff.value - diff.seasonal >= 3 ? '<b data-tone="neg">acima</b>' : diff.value - diff.seasonal <= -3 ? '<b data-tone="pos">abaixo</b>' : "perto") + " da média do mês (" + pct(diff.seasonal, n1) + ")" : "dos itens subiram") +
        kpi("Commodities em reais · 12 meses", ic ? signed(ic.twelve) : "—", ic ? "IC-Br do BC; " + signed(ic.quarter) + " em 3 meses" : "", ic?.twelve > 10 ? "neg" : "");
      const spread = diff?.seasonal != null ? diff.value - diff.seasonal : null;
      const energy = d.commodities.icbr_energia, agro = d.commodities.icbr_agro;
      root.querySelector(".cpRead").innerHTML =
        "O IPCA acumula <b>" + pct(d.ipca.twelve) + "</b> em 12 meses e a média dos núcleos, <b>" + pct(core.twelve) + "</b>. " +
        "No ritmo dos últimos 3 meses, os núcleos correm a <b>" + pct(core.saar3) + "</b> ao ano" +
        (core.saar3 < core.twelve - 0.3 ? ", <b>desacelerando</b>" : core.saar3 > core.twelve + 0.3 ? ", <b>acelerando</b>" : ", estáveis") + ". " +
        (serv ? "Serviços, o componente mais ligado ao mercado de trabalho, sobem <b>" + pct(serv.twelve) + "</b>. " : "") +
        (diff ? "A alta está " + (spread != null && spread >= 3 ? "<b>mais espalhada</b> que o normal para o mês" : spread != null && spread <= -3 ? "<b>mais concentrada</b> que o normal para o mês" : "espalhada como de costume para o mês") + " (" + pct(diff.value, n1) + " dos itens). " : "") +
        (free && adm ? "Preços livres: " + pct(free.twelve) + "; monitorados: " + pct(adm.twelve) + ". " : "") +
        (energy && agro ? "Nas commodities em reais, energia " + signed(energy.twelve) + " e agropecuária " + signed(agro.twelve) + " em 12 meses." : "");
      root.querySelector(".ifStamp").textContent = "IPCA de " + month(d.ipca.observed) + (ic ? " · IC-Br de " + month(ic.observed) : "");
      draw();
    } catch {
      root.querySelector(".ifPlot").innerHTML = failure("as séries de inflação");
    }
  }
  draw();
  load();
  setInterval(load, 1800000);
}
