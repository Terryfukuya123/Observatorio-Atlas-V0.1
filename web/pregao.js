// Pregão da B3: quanto se negociou, quem negociou e para onde foi o dinheiro estrangeiro.
// Fonte: relatório "Dados de Mercado" da B3, baixado à mão e salvo em data/b3/ (a B3 veda
// coleta automática). O relatório é acumulado no mês: volume até D-1 e investidores até
// D-2. Cada importação vira um retrato; a diferença entre dois retratos dá o pregão.
// Exibição a terceiros pendente de licença de Market Data da B3.
import { cachedFetch } from "./data.js";
import { esc, nf, sign, tone, monthShort as monthName, dayMonth as shortDay } from "./format.js";

export const INVESTORS = [
  ["foreign", "Estrangeiros"],
  ["institutions", "Institucionais"],
  ["individuals", "Pessoas físicas"],
  ["banks", "Instituições financeiras"],
  ["others", "Outros"],
];
const isMonth = (k) => /^\d{4}-\d{2}$/.test(k);
const isYear = (k) => /^\d{4}$/.test(k);
export { monthName };
export { shortDay };
// Valores chegam em R$ milhões.
export function brl(millions, signed = false) {
  const v = Number(millions);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const body = abs >= 1000 ? nf(1).format(abs / 1000) + " bi" : nf(0).format(abs) + " mi";
  return (signed ? sign(v) : v < 0 ? "−" : "") + "R$ " + body;
}

const months = (block) => Object.keys(block || {}).filter(isMonth).sort();
const years = (block) => Object.keys(block || {}).filter(isYear).sort();

// Números do relatório organizados para a tela e para o resumo do pós-mercado.
export function digest(d) {
  const volMonth = d.cutoff?.volume?.slice(0, 7) || months(d.volume).at(-1);
  const invMonth = (d.cutoff?.participation || d.cutoff?.foreign)?.slice(0, 7) || months(d.foreign).at(-1);
  const prevYear = String(d.year - 1);
  const avg = d.average?.[volMonth]?.brl;
  const avgPrev = d.average?.[prevYear]?.brl;
  const invMonths = months(d.foreign);
  const prevInv = invMonths[invMonths.indexOf(invMonth) - 1];
  const partMonths = months(d.participation);
  const prevPart = partMonths[partMonths.indexOf(invMonth) - 1];
  const days = d.days || [];
  return {
    volMonth,
    invMonth,
    volCut: d.cutoff?.volume,
    invCut: d.cutoff?.participation || d.cutoff?.foreign,
    avg,
    avgPrev,
    avgVsPrev: avg && avgPrev ? (avg / avgPrev - 1) * 100 : null,
    monthTotal: d.volume?.[volMonth]?.total,
    foreign: d.foreign?.[invMonth],
    foreignPrev: prevInv ? { month: prevInv, ...d.foreign[prevInv] } : null,
    foreignYear: d.foreign?.[d.year + "*"],
    share: d.participation?.[invMonth],
    sharePrev: prevPart ? d.participation[prevPart] : null,
    lastVolume: days.filter((x) => x.kind === "volume").at(-1) || null,
    lastForeign: days.filter((x) => x.kind === "foreign").at(-1) || null,
  };
}

const range = (x) => (x.from && x.to ? (sessions(x.from, x.to) > 1 ? shortDay(next(x.from)) + " a " + shortDay(x.to) : shortDay(x.to)) : "");
const next = (iso) => {
  const t = new Date(iso + "T12:00:00Z");
  do t.setUTCDate(t.getUTCDate() + 1);
  while (t.getUTCDay() === 0 || t.getUTCDay() === 6);
  return t.toISOString().slice(0, 10);
};
// Dias úteis entre dois retratos (sem feriados): diz se a diferença cobre mais de um pregão.
export function sessions(from, to) {
  let n = 0;
  for (let d = next(from); d <= to; d = next(d)) n++;
  return n;
}

// Leitura em texto: o que os números dizem sobre o pregão e o mês.
export function reading(d, g = digest(d)) {
  const out = [];
  if (g.avg) {
    let s = "Em " + monthName(g.volMonth) + ", a bolsa negocia em média <b>" + esc(brl(g.avg)) + "</b> por pregão";
    if (g.avgVsPrev != null) s += ", " + (Math.abs(g.avgVsPrev) < 3 ? "em linha com" : g.avgVsPrev > 0 ? nf(0).format(g.avgVsPrev) + "% acima de" : nf(0).format(-g.avgVsPrev) + "% abaixo de") + " " + (d.year - 1);
    out.push(s + ".");
  }
  if (g.lastVolume) {
    const n = sessions(g.lastVolume.from, g.lastVolume.to);
    const per = g.lastVolume.total / Math.max(n, 1);
    let s = (n > 1 ? "Nos pregões de " : "No pregão de ") + range(g.lastVolume) + " giraram <b>" + esc(brl(g.lastVolume.total)) + "</b>";
    if (g.avg) s += ", " + (per > g.avg * 1.1 ? "acima" : per < g.avg * 0.9 ? "abaixo" : "perto") + " da média do mês";
    out.push(s + ".");
  }
  if (g.share) {
    let s = "Estrangeiros respondem por <b>" + nf(1).format(g.share.foreign) + "%</b> do volume, institucionais por " + nf(1).format(g.share.institutions) + "% e pessoas físicas por " + nf(1).format(g.share.individuals) + "%";
    if (g.sharePrev) {
      const diff = g.share.foreign - g.sharePrev.foreign;
      if (Math.abs(diff) >= 1) s += " (fatia estrangeira " + (diff > 0 ? "maior" : "menor") + " que no mês anterior, " + sign(diff) + nf(1).format(Math.abs(diff)) + " p.p.)";
    }
    out.push(s + ".");
  }
  if (g.foreign) {
    const b = g.foreign.balance;
    let s = "No mês, até " + shortDay(g.invCut) + ", o estrangeiro " + (b >= 0 ? "comprou" : "vendeu") + " <b>" + esc(brl(Math.abs(b))) + "</b> líquidos";
    if (g.foreignPrev) {
      const pb = g.foreignPrev.balance;
      s += (Math.sign(pb) === Math.sign(b) ? ", mantendo a direção de " : ", invertendo a direção de ") + monthName(g.foreignPrev.month) + " (" + brl(pb, true) + ")";
    }
    out.push(s + ".");
  }
  if (g.lastForeign) {
    out.push("Saldo estrangeiro de " + range(g.lastForeign) + ": <b>" + esc(brl(g.lastForeign.balance, true)) + "</b> (compras " + esc(brl(g.lastForeign.buy)) + ", vendas " + esc(brl(g.lastForeign.sell)) + ").");
  }
  if (g.foreignYear) out.push("No ano, o saldo estrangeiro está em <b>" + esc(brl(g.foreignYear.balance, true)) + "</b>, contando ofertas de ações (IPO e follow-on).");
  return out;
}

// Barras verticais simples ou divergentes. rows: [{label, value, title, partial}]
function columns(rows, { divergent = false, reference = null, refLabel = "", height = 210 } = {}) {
  const W = 420;
  const H = height;
  const top = 16;
  const bottom = 28;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), reference || 0, 1);
  const zero = divergent ? top + (H - top - bottom) / 2 : H - bottom;
  const scale = (divergent ? (H - top - bottom) / 2 : H - top - bottom) / max;
  const slot = W / rows.length;
  const bw = Math.min(22, slot * 0.62);
  const every = Math.ceil(rows.length / 7);
  const bars = rows
    .map((r, i) => {
      const cx = slot * i + slot / 2;
      const h = Math.max(Math.abs(r.value) * scale, 0.5);
      const y = r.value >= 0 ? zero - h : zero;
      return (
        '<g class="pgSlot' + (r.partial ? " partial" : "") + '"><title>' + esc(r.title) + "</title>" +
        '<rect class="hit" x="' + (slot * i).toFixed(1) + '" y="0" width="' + slot.toFixed(1) + '" height="' + H + '"/>' +
        '<rect class="bar" data-tone="' + (divergent ? tone(r.value) : "flat") + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>' +
        (i % every ? "" : '<text x="' + cx.toFixed(1) + '" y="' + (H - 9) + '">' + esc(r.label) + "</text>") +
        "</g>"
      );
    })
    .join("");
  const ref = reference
    ? '<path class="ref" d="M0 ' + (zero - reference * scale).toFixed(1) + "H" + W + '"/><text class="ref" x="2" y="11">- - ' + esc(refLabel) + "</text>"
    : "";
  return (
    '<svg class="pgChart" viewBox="0 0 ' + W + " " + H + '" role="img">' +
    '<path class="zero" d="M0 ' + zero.toFixed(1) + "H" + W + '"/>' + bars + ref + "</svg>"
  );
}

// Participação: uma barra empilhada (100%) por período.
function stacks(rows) {
  const W = 420;
  const row = 20;
  const label = 46;
  const H = rows.length * row + 4;
  const body = rows
    .map((r, i) => {
      let x = label;
      const y = i * row + 4;
      const total = INVESTORS.reduce((s, [k]) => s + (r.values[k] || 0), 0) || 100;
      const parts = INVESTORS.map(([k, name], j) => {
        const w = ((r.values[k] || 0) / total) * (W - label);
        const piece =
          '<rect class="inv' + j + '" x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + (row - 6) + '"><title>' +
          esc(r.label + " · " + name + ": " + nf(1).format(r.values[k] || 0) + "%") + "</title></rect>" +
          (w > 24 ? '<text class="in" x="' + (x + w / 2).toFixed(1) + '" y="' + (y + row / 2 + 1) + '">' + nf(0).format(r.values[k]) + "%</text>" : "");
        x += w;
        return piece;
      }).join("");
      return '<g class="' + (r.partial ? "partial" : "") + '"><text class="lab" x="0" y="' + (y + row / 2 + 1) + '">' + esc(r.label) + "</text>" + parts + "</g>";
    })
    .join("");
  return '<svg class="pgStack" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Participação por tipo de investidor">' + body + "</svg>";
}

function kpi(title, value, sub, t = "flat", extra = "") {
  return '<article class="flowKpi card" data-tone="' + t + '"><h3>' + esc(title) + "</h3><strong>" + esc(value) + "</strong><small>" + sub + "</small>" + extra + "</article>";
}

function render(root, d) {
  const g = digest(d);
  const $ = (s) => root.querySelector(s);
  const prev = d.year - 1;

  $("#pgKpis").innerHTML = [
    kpi("Volume médio diário · " + monthName(g.volMonth), brl(g.avg), g.avgVsPrev == null ? "" : '<span class="flowDiff" data-tone="' + tone(g.avgVsPrev) + '">' + (g.avgVsPrev >= 0 ? "▲" : "▼") + " " + nf(1).format(Math.abs(g.avgVsPrev)) + "%</span> vs média de " + prev, "flat", "<p>Acumulado no mês: " + esc(brl(g.monthTotal)) + " até " + esc(shortDay(g.volCut)) + "</p>"),
    g.lastVolume
      ? kpi("Último pregão · " + range(g.lastVolume), brl(g.lastVolume.total), nf(0).format(g.lastVolume.trades / 1000) + " mil negócios", "flat", "<p>À vista: " + esc(brl(g.lastVolume.cash)) + "</p>")
      : kpi("Último pregão", "—", "Volume do dia aparece a partir da segunda importação", "flat", "<p>Cada relatório importado é guardado; a diferença entre dois dias dá o pregão.</p>"),
    g.foreign
      ? kpi("Estrangeiros · " + monthName(g.invMonth), brl(g.foreign.balance, true), (g.foreign.balance >= 0 ? "compra líquida" : "venda líquida") + " até " + esc(shortDay(g.invCut)), tone(g.foreign.balance), g.foreignYear ? "<p>No ano: <b>" + esc(brl(g.foreignYear.balance, true)) + "</b></p>" : "")
      : "",
    g.share
      ? kpi("Fatia estrangeira", nf(1).format(g.share.foreign) + "%", "do volume em " + monthName(g.invMonth), "flat", "<p>Institucionais " + nf(1).format(g.share.institutions) + "% · Pessoas físicas " + nf(1).format(g.share.individuals) + "%</p>")
      : "",
  ].join("");

  $("#pgReading").innerHTML = reading(d, g).map((s) => "<li>" + s + "</li>").join("");

  const vol = months(d.average).map((k) => ({
    label: monthName(k),
    value: d.average[k].brl / 1000,
    partial: k === g.volMonth,
    title: monthName(k) + ": " + brl(d.average[k].brl) + " por pregão (US$ " + nf(1).format(d.average[k].usd / 1000) + " bi)" + (k === g.volMonth ? " · parcial até " + shortDay(g.volCut) : ""),
  }));
  const ref = d.average?.[String(prev)]?.brl;
  $("#pgVolume").innerHTML = vol.length ? columns(vol, { reference: ref ? ref / 1000 : null, refLabel: "média de " + prev + ": " + brl(ref) }) : '<p class="empty">Sem dados.</p>';

  const fx = months(d.foreign).map((k) => {
    const f = d.foreign[k];
    return {
      label: monthName(k),
      value: f.balance / 1000,
      partial: k === g.invMonth,
      title: monthName(k) + ": saldo " + brl(f.balance, true) + " · compras " + brl(f.buy) + " · vendas " + brl(f.sell) + (f.ipo ? " · ofertas " + brl(f.ipo) : "") + (k === g.invMonth ? " · parcial até " + shortDay(g.invCut) : ""),
    };
  });
  $("#pgForeign").innerHTML = fx.length ? columns(fx, { divergent: true }) : '<p class="empty">Sem dados.</p>';
  const ys = years(d.foreign).slice(-6);
  $("#pgForeignYears").innerHTML = ys.length
    ? '<ul class="pgYears">' + [...ys, d.year + "*"].filter((k) => d.foreign[k]).map((k) => '<li data-tone="' + tone(d.foreign[k].balance) + '"><span>' + esc(k.replace("*", " (até " + shortDay(g.invCut) + ")")) + "</span><b>" + esc(brl(d.foreign[k].balance, true)) + "</b></li>").join("") + "</ul>"
    : "";

  const part = [
    ...months(d.participation).map((k) => ({ label: monthName(k), values: d.participation[k], partial: k === g.invMonth })),
    ...years(d.participation).slice(-4).reverse().map((k) => ({ label: k, values: d.participation[k] })),
  ];
  $("#pgShare").innerHTML = part.length ? stacks(part) : '<p class="empty">Sem dados.</p>';

  const days = (d.days || []).slice(-10).reverse();
  $("#pgDays").innerHTML = days.length
    ? '<ul class="pgDays">' + days.map((x) => "<li><time>" + esc(range(x)) + "</time><span>" + (x.kind === "volume" ? "Volume" : "Saldo estrangeiro") + '</span><b data-tone="' + (x.kind === "volume" ? "flat" : tone(x.balance)) + '">' + esc(x.kind === "volume" ? brl(x.total) : brl(x.balance, true)) + "</b></li>").join("") + "</ul>"
    : '<p class="ppMuted">O dia a dia começa na segunda importação: importe o relatório de cada dia e a diferença entre eles mostra o pregão.</p>';

  $("#pgNote").innerHTML =
    "Fonte: B3, relatório <i>Dados de Mercado</i> (arquivo " + esc(d.file || "importado") + "), importado manualmente. Volume até " + esc(shortDay(g.volCut || "")) +
    " (D+1); investidores e estrangeiros até " + esc(shortDay(g.invCut || "")) + " (D+2). Mês corrente parcial (barras claras). " +
    "Dados de propriedade da B3; exibição a terceiros pendente de licença de Market Data.";
  $("#pgStamp").textContent = "B3 · até " + shortDay(g.volCut || "");
}

export function pregao({ root }) {
  cachedFetch("/api/b3")
    .then((r) => (r.ok ? r.json() : null))
    .then((b3) => {
      if (!b3?.data) {
        root.querySelector("#pgKpis").innerHTML =
          '<div class="ppPending"><b>' + esc(b3?.status || "Aguardando importação") + '</b><p>Baixe o relatório <i>Dados de Mercado</i> no site da B3 e salve o arquivo na pasta <code>data/b3</code> do Observatório. A B3 não permite coleta automática.</p></div>';
        return;
      }
      render(root, { ...b3.data, file: b3.file });
    })
    .catch(() => {
      root.querySelector("#pgKpis").innerHTML = '<p class="empty">Não foi possível ler o relatório da B3.</p>';
    });
}
