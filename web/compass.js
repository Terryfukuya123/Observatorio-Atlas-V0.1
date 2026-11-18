// Bússola dos juros: Selic e IPCA realizados, a meta de inflação com o intervalo de
// tolerância e o caminho esperado pelo Focus, num só gráfico. Mais o Focus em gráficos.
import { cachedFetch } from "./data.js";
const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => (v == null ? null : Number(v));
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1] + "/" + iso.slice(2, 4);

// Meta de inflação do CMN por ano-calendário; tolerância de 1,5 p.p.
export const TARGET = { 2021: 3.75, 2022: 3.5, 2023: 3.25 };
export const target = (year) => TARGET[year] ?? 3;
export const TOLERANCE = 1.5;

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

const focusYears = (focus, id) => (focus?.indicators?.find((i) => i.id === id)?.years || []).map((y) => [y.year, num(y.median)]);

// Juro real ex-ante: Selic descontada da inflação esperada para o ano seguinte.
export function realRate(selic, expected) {
  return ((1 + selic / 100) / (1 + expected / 100) - 1) * 100;
}

function chart({ ipca, selic, fIpca, fSelic, today }) {
  const W = 760;
  const H = 280;
  const L = 34;
  const R = 112;
  const T = 14;
  const B = 26;
  const start = Date.UTC(today.getUTCFullYear() - 2, 0, 1);
  const lastYear = Math.max(...fIpca.map(([y]) => Number(y)), today.getUTCFullYear());
  const end = Date.UTC(lastYear, 11, 31);
  const t = (iso) => Date.parse(iso.length === 4 ? iso + "-12-31T00:00:00Z" : iso.slice(0, 10) + "T00:00:00Z");
  const x = (ms) => L + ((ms - start) / (end - start)) * (W - L - R);
  const real = (pts) => pts.filter(([d]) => t(d) >= start);
  const ip = real(ipca);
  const se = real(selic);
  const values = [...ip, ...se, ...fIpca, ...fSelic].map(([, v]) => num(v)).filter(Number.isFinite);
  const top = Math.ceil(Math.max(...values, 6) + 1);
  const y = (v) => T + ((top - v) / top) * (H - T - B);
  const path = (pts) => pts.map(([d, v], i) => (i ? "L" : "M") + x(t(d)).toFixed(1) + " " + y(num(v)).toFixed(1)).join("");
  let out = "";
  // Faixa da meta, ano a ano.
  for (let yr = today.getUTCFullYear() - 2; yr <= lastYear; yr++) {
    const a = x(Date.UTC(yr, 0, 1));
    const b = x(Date.UTC(yr, 11, 31));
    const c = target(yr);
    out +=
      '<rect class="cpBand" x="' + a.toFixed(1) + '" y="' + y(c + TOLERANCE).toFixed(1) + '" width="' + (b - a).toFixed(1) + '" height="' +
      (y(c - TOLERANCE) - y(c + TOLERANCE)).toFixed(1) + '"/><path class="cpTarget" d="M' + a.toFixed(1) + " " + y(c).toFixed(1) + "H" + b.toFixed(1) + '"/>' +
      '<text class="cpYear" x="' + ((a + b) / 2).toFixed(1) + '" y="' + (H - 8) + '">' + yr + "</text>";
  }
  for (let v = 0; v <= top; v += top > 12 ? 4 : 2)
    out += '<path class="cpGrid" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + v + "%</text>";
  const now = x(today.getTime());
  out += '<path class="cpNow" d="M' + now.toFixed(1) + " " + T + "V" + (H - B) + '"/><text class="cpNowText" x="' + (now + 4).toFixed(1) + '" y="' + (T + 8) + '">hoje</text>';
  // Futuro: do último dado realizado até a mediana do Focus de cada fim de ano.
  const ahead = (last, pts) => [last, ...pts.filter(([yr]) => t(yr) > t(last[0]))];
  if (ip.length && fIpca.length) out += '<path class="cpLine cpIpca cpFuture" d="' + path(ahead(ip.at(-1), fIpca)) + '"/>';
  if (se.length && fSelic.length) out += '<path class="cpLine cpSelic cpFuture" d="' + path(ahead(se.at(-1), fSelic)) + '"/>';
  if (ip.length) out += '<path class="cpLine cpIpca" d="' + path(ip) + '"/>';
  if (se.length) out += '<path class="cpLine cpSelic" d="' + path(se) + '"/>';
  for (const [pts, cls] of [[fIpca, "cpIpca"], [fSelic, "cpSelic"]])
    for (const [yr, v] of pts)
      if (t(yr) > today.getTime())
        out += '<circle class="cpDot ' + cls + '" cx="' + x(t(yr)).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3"><title>Focus ' + yr + ": " + n2.format(v) + "%</title></circle>";
  // Rótulos no fim de cada linha.
  const tag = (pts, cls, text) => {
    const [d, v] = pts.at(-1);
    return '<text class="cpTag ' + cls + '" x="' + (x(t(d)) + 8).toFixed(1) + '" y="' + (y(num(v)) + 4).toFixed(1) + '">' + esc(text) + "</text>";
  };
  if (fSelic.length) out += tag(fSelic, "cpSelic", "Selic " + n2.format(fSelic.at(-1)[1]) + "%");
  if (fIpca.length) out += tag(fIpca, "cpIpca", "IPCA " + n2.format(fIpca.at(-1)[1]) + "%");
  out += '<text class="cpTag cpMeta" x="' + (W - R + 8) + '" y="' + (y(3) + 4).toFixed(1) + '">meta 3%</text>';
  return (
    '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Selic e IPCA em 12 meses realizados e esperados pelo Focus, com a meta de inflação">' +
    out + "</svg>"
  );
}

function kpi(label, value, note, toneName = "") {
  return '<div class="cpKpi"' + (toneName ? ' data-tone="' + toneName + '"' : "") + "><span>" + esc(label) + "</span><strong>" + esc(value) + "</strong><small>" +
    note + "</small></div>";
}

export function compass({ root }) {
  async function load() {
    try {
      const [macro, focus] = await Promise.all([json("/api/macro"), json("/api/macro/focus")]);
      const find = (id) => macro.brasil.find((s) => s.id === id);
      const selicItem = find("selic_meta");
      const ipcaItem = find("ipca_12m");
      const today = new Date(Date.parse(selicItem.observed + "T12:00:00Z"));
      const fIpca = focusYears(focus, "focus_ipca");
      const fSelic = focusYears(focus, "focus_selic");
      const selic = num(selicItem.value);
      const ipca = num(ipcaItem.value);
      const year = today.getUTCFullYear();
      const next = fIpca.find(([y]) => Number(y) === year + 1)?.[1];
      const real = next == null ? null : realRate(selic, next);
      const ceiling = target(Number(ipcaItem.observed.slice(0, 4))) + TOLERANCE;
      const gap = ipca - ceiling;
      const back = fIpca.find(([y, v]) => v <= target(Number(y)) + TOLERANCE);
      const center = fIpca.find(([y, v]) => v <= target(Number(y)) + 0.05);
      const nextSelic = fSelic.find(([y]) => Number(y) === year + 1);
      root.querySelector(".cpKpis").innerHTML =
        kpi("Selic meta", n2.format(selic) + "%", nextSelic ? "Focus: " + n2.format(nextSelic[1]) + "% no fim de " + nextSelic[0] : "") +
        kpi("IPCA em 12 meses", n2.format(ipca) + "%",
          gap > 0 ? n2.format(gap) + " p.p. <b data-tone=\"neg\">acima do teto</b> de " + n2.format(ceiling) + "%" : "<b data-tone=\"pos\">dentro do intervalo</b> da meta",
          gap > 0 ? "neg" : "pos") +
        kpi("Juro real ex-ante", real == null ? "—" : n2.format(real) + "%", "Selic descontada do IPCA esperado para " + (year + 1)) +
        kpi("Volta à meta", back ? back[0] : "Depois de " + (fIpca.at(-1)?.[0] || year),
          back ? "IPCA esperado de " + n2.format(back[1]) + "%, dentro do intervalo" + (center ? "; no centro em " + center[0] : "; ainda acima do centro de 3%") : "Focus não vê o IPCA no intervalo");
      root.querySelector(".cpRead").innerHTML =
        "A Selic está em <b>" + n2.format(selic) + "%</b> e a inflação em 12 meses em <b>" + n2.format(ipca) + "%</b>" +
        (real == null ? "." : ": um juro real de cerca de <b>" + n2.format(real) + "%</b> ao ano.") +
        (fSelic.length ? " O mercado espera a Selic em <b>" + n2.format(fSelic.at(-1)[1]) + "%</b> em " + fSelic.at(-1)[0] + "," : "") +
        (back ? " com o IPCA de volta ao intervalo da meta em <b>" + back[0] + "</b>." : " sem o IPCA de volta ao intervalo da meta no horizonte do Focus.");
      root.querySelector(".cpPlot").innerHTML = chart({
        ipca: ipcaItem.history,
        selic: selicItem.monthly || selicItem.history,
        fIpca,
        fSelic,
        today,
      });
      root.querySelector(".cpStamp").textContent = "IPCA até " + monthLabel(ipcaItem.observed) + " · Selic em " + selicItem.observed.split("-").reverse().join("/");
    } catch {
      root.querySelector(".cpPlot").innerHTML = '<p class="empty">Juros e inflação indisponíveis no momento.</p>';
    }
  }
  load();
  setInterval(load, 1800000);
}

// Focus em pequenos gráficos: a mediana de cada ano e como ela mudou nas últimas semanas.
export function focusCharts({ root, read, save }) {
  const host = root.querySelector("#focusCharts");
  const table = root.querySelector("#focusTable");
  const tabs = [...root.querySelectorAll("[data-focus-view]")];
  let view = read("focusView", "charts") === "table" ? "table" : "charts";
  const apply = () => {
    host.hidden = view !== "charts";
    table.hidden = view !== "table";
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.focusView === view));
  };
  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.focusView;
      save("focusView", view);
      apply();
    });
  apply();

  const fmt = (v, ind) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: ind.decimals ?? 2, maximumFractionDigits: ind.decimals ?? 2 }).format(v);
  function spark(years) {
    const lines = years.slice(0, 2).map((y) => (y.history || []).map(([, v]) => num(v)));
    const all = lines.flat().filter(Number.isFinite);
    if (all.length < 2) return "";
    const min = Math.min(...all);
    const span = Math.max(...all) - min || 1;
    return (
      '<svg class="fcSpark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">' +
      lines
        .map((l, k) =>
          l.length < 2 ? "" : '<path class="' + (k ? "next" : "") + '" d="' + l.map((v, i) => (i ? "L" : "M") + ((i / (l.length - 1)) * 100).toFixed(1) + " " + (31 - ((v - min) / span) * 28).toFixed(1)).join("") + '"/>')
        .join("") +
      "</svg>"
    );
  }
  async function load() {
    try {
      const focus = await json("/api/macro/focus");
      host.innerHTML = focus.indicators
        .map((ind) => {
          const [cur, nxt] = ind.years;
          const v = num(cur.median);
          const before = num(cur.four_weeks_ago?.median);
          const delta = before == null ? null : v - before;
          const tr = cur.trend || {};
          const dir = tr.direction === "alta" ? "up" : tr.direction === "queda" ? "down" : "flat";
          return (
            '<article class="fcCard"><header><h3>' + esc(ind.name) + "</h3><small>" + esc(ind.unit) + "</small></header>" +
            '<p class="fcValue"><strong>' + fmt(v, ind) + "</strong><span>" + esc(cur.year) + "</span>" +
            '<em data-dir="' + dir + '">' + (dir === "flat" ? "estável" : (dir === "up" ? "▲ " : "▼ ") + tr.weeks + " sem.") + "</em></p>" +
            spark(ind.years) +
            '<p class="fcLegend"><i></i>' + esc(cur.year) + (nxt ? ' <i class="next"></i>' + esc(nxt.year) : "") + " · desde " +
            esc(monthLabel(cur.history?.[0]?.[0] || cur.observed)) + "</p>" +
            '<p class="fcDelta">' + (delta == null ? "" : "Há 4 semanas: " + fmt(before, ind) + " (" + (delta > 0 ? "+" : delta < 0 ? "−" : "") + fmt(Math.abs(delta), ind) + ")") + "</p>" +
            '<ol class="fcYears">' + ind.years.map((y) => "<li><span>" + esc(y.year) + "</span><b>" + fmt(num(y.median), ind) + "</b></li>").join("") + "</ol></article>"
          );
        })
        .join("");
    } catch {
      host.innerHTML = '<p class="empty">Focus indisponível no momento.</p>';
    }
  }
  load();
  setInterval(load, 1800000);
}
