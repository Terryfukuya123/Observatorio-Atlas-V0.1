// Relógio do ciclo econômico: cada economia num plano com o nível do indicador antecedente
// da OCDE (acima ou abaixo da tendência, 100) e a variação no último mês. Os quadrantes
// são as quatro fases do ciclo. Também o histórico do sinal de recessão da curva dos EUA.
import { flagAt, round } from "./symbols.js";

export const NAMES = {
  G20: "G20", G7: "G7", USA: "Estados Unidos", CHN: "China", DEU: "Alemanha", JPN: "Japão", GBR: "Reino Unido", IND: "Índia", FRA: "França",
  ITA: "Itália", BRA: "Brasil", MEX: "México", KOR: "Coreia do Sul", CAN: "Canadá", AUS: "Austrália", ESP: "Espanha", TUR: "Turquia",
  IDN: "Indonésia", ZAF: "África do Sul",
};
const PHASES = [
  ["Expansão", "acima da tendência e subindo"],
  ["Desaceleração", "acima da tendência e caindo"],
  ["Contração", "abaixo da tendência e caindo"],
  ["Recuperação", "abaixo da tendência e subindo"],
];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const month = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1] + "/" + iso.slice(2, 4);
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function phase(level, change) {
  if (level >= 100) return change >= 0 ? "Expansão" : "Desaceleração";
  return change >= 0 ? "Recuperação" : "Contração";
}

// Pontos (nível, variação mensal) de uma série do CLI.
export function track(history) {
  const v = history.map(([d, x]) => [d, Number(x)]);
  return v.slice(1).map(([d, x], i) => ({ date: d, level: x, change: x - v[i][1] }));
}

// Há quantos meses a economia está na fase atual.
export function streak(points) {
  const now = phase(points.at(-1).level, points.at(-1).change);
  let n = 0;
  for (let i = points.length - 1; i >= 0 && phase(points[i].level, points[i].change) === now; i--) n++;
  return n;
}

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

export function cycleClock({ root, read, save }) {
  const plot = root.querySelector(".ccPlot");
  const side = root.querySelector(".ccSide");
  let areas = {};
  let picked = read("cyclePick", "BRA");

  function draw() {
    const codes = Object.keys(areas);
    if (!codes.length) return;
    if (!areas[picked]) picked = codes.includes("BRA") ? "BRA" : codes[0];
    const last = Object.fromEntries(codes.map((k) => [k, areas[k].points.at(-1)]));
    const trail = areas[picked].points.slice(-7);
    const all = [...codes.map((k) => last[k]), ...trail];
    const dx = Math.max(...all.map((p) => Math.abs(p.level - 100)), 0.5) * 1.15;
    const dy = Math.max(...all.map((p) => Math.abs(p.change)), 0.05) * 1.2;
    const W = 720;
    const H = 460;
    const P = 26;
    const x = (v) => P + ((v - (100 - dx)) / (2 * dx)) * (W - 2 * P);
    const y = (v) => P + ((dy - v) / (2 * dy)) * (H - 2 * P);
    const cx = x(100);
    const cy = y(0);
    let out =
      '<rect class="ccQ ccExp" x="' + cx + '" y="' + P + '" width="' + (W - P - cx) + '" height="' + (cy - P) + '"/>' +
      '<rect class="ccQ ccDes" x="' + cx + '" y="' + cy + '" width="' + (W - P - cx) + '" height="' + (H - P - cy) + '"/>' +
      '<rect class="ccQ ccCon" x="' + P + '" y="' + cy + '" width="' + (cx - P) + '" height="' + (H - P - cy) + '"/>' +
      '<rect class="ccQ ccRec" x="' + P + '" y="' + P + '" width="' + (cx - P) + '" height="' + (cy - P) + '"/>' +
      '<path class="ccAxis" d="M' + cx + " " + P + "V" + (H - P) + "M" + P + " " + cy + "H" + (W - P) + '"/>' +
      '<text class="ccLabel ccExp" x="' + (W - P - 10) + '" y="' + (P + 20) + '" text-anchor="end">Expansão</text>' +
      '<text class="ccLabel ccDes" x="' + (W - P - 10) + '" y="' + (H - P - 10) + '" text-anchor="end">Desaceleração</text>' +
      '<text class="ccLabel ccCon" x="' + (P + 10) + '" y="' + (H - P - 10) + '">Contração</text>' +
      '<text class="ccLabel ccRec" x="' + (P + 10) + '" y="' + (P + 20) + '">Recuperação</text>' +
      '<text class="ccTick" x="' + (cx + 4) + '" y="' + (H - P + 16) + '">100 = tendência</text>' +
      '<text class="ccTick" x="' + (W - P) + '" y="' + (H - P + 16) + '" text-anchor="end">nível do indicador →</text>' +
      '<text class="ccTick" x="' + (P - 6) + '" y="' + (P - 8) + '">↑ subindo no mês</text>';
    // Caminho dos últimos meses da economia escolhida.
    out +=
      '<path class="ccTrail" d="' + trail.map((p, i) => (i ? "L" : "M") + x(p.level).toFixed(1) + " " + y(p.change).toFixed(1)).join("") + '"/>' +
      trail.slice(0, -1).map((p) => '<circle class="ccStep" cx="' + x(p.level).toFixed(1) + '" cy="' + y(p.change).toFixed(1) + '" r="3"><title>' +
        esc(month(p.date)) + "</title></circle>").join("") +
      '<text class="ccStepLabel" x="' + (x(trail[0].level) + 6).toFixed(1) + '" y="' + (y(trail[0].change) - 6).toFixed(1) + '">' + esc(month(trail[0].date)) + "</text>";
    // Bandeiras: a escolhida por último, para ficar por cima.
    const order = codes.filter((k) => k !== picked).concat(picked);
    out += order
      .map((k) => {
        const p = last[k];
        // No celular o gráfico encolhe: bandeiras maiores em unidades do SVG.
        const size = (k === picked ? 30 : 22) * (window.matchMedia("(max-width: 670px)").matches ? 1.7 : 1);
        return '<g class="ccFlag' + (k === picked ? " on" : "") + '" data-area="' + k + '" tabindex="0" role="button" aria-label="' +
          esc(NAMES[k] || k) + ": " + phase(p.level, p.change) + '"><title>' + esc((NAMES[k] || k) + " · " + nf1.format(p.level) + " · " + nf2.format(p.change) + " no mês") +
          "</title>" + flagAt(k, x(p.level), y(p.change), size, "cc") + "</g>";
      })
      .join("");
    plot.innerHTML = '<svg class="ccChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Relógio do ciclo econômico">' + out + "</svg>";

    // Lateral: a economia escolhida e as fases.
    const p = last[picked];
    const ph = phase(p.level, p.change);
    const months = streak(areas[picked].points);
    const groups = PHASES.map(([name, hint]) => [name, hint, codes.filter((k) => phase(last[k].level, last[k].change) === name)]);
    side.innerHTML =
      '<div class="ccPick">' + round(picked) + "<div><strong>" + esc(NAMES[picked] || picked) + '</strong><span data-phase="' + ph + '">' + ph +
      (months > 1 ? " há " + months + " meses" : " desde " + month(p.date)) + "</span></div></div>" +
      '<dl class="ccNums"><div><dt>Nível</dt><dd>' + nf1.format(p.level) + "</dd></div><div><dt>No mês</dt><dd>" + nf2.format(p.change) +
      "</dd></div><div><dt>Referência</dt><dd>" + esc(month(p.date)) + "</dd></div></dl>" +
      groups
        .map(([name, hint, list]) =>
          '<div class="ccGroup" data-phase="' + name + '"><h3>' + name + " <small>" + list.length + "</small></h3><p>" + hint + '</p><div class="ccChips">' +
          (list.length
            ? list.map((k) => '<button data-area="' + k + '" aria-pressed="' + (k === picked) + '">' + round(k) + "<span>" + esc(NAMES[k] || k) + "</span></button>").join("")
            : '<em>nenhuma</em>') +
          "</div></div>")
        .join("");
    const total = codes.filter((k) => k !== "G20" && k !== "G7").length;
    const countries = codes.filter((k) => k !== "G20" && k !== "G7");
    const above = countries.filter((k) => last[k].level >= 100).length;
    const g20 = last.G20 ? phase(last.G20.level, last.G20.change) : null;
    root.querySelector(".ccRead").innerHTML =
      "<b>" + above + " de " + total + "</b> economias estão acima da tendência, <b>" +
      countries.filter((k) => phase(last[k].level, last[k].change) === "Expansão").length + "</b> delas ainda acelerando." +
      (g20 ? " O G20 como um todo está em <b data-phase=\"" + g20 + "\">" + g20.toLowerCase() + "</b>." : "") +
      " Toque numa bandeira para ver o caminho dos últimos seis meses.";
  }

  function pick(code) {
    if (!code || !areas[code]) return;
    picked = code;
    save("cyclePick", code);
    draw();
  }
  // A busca universal pode pedir um país específico.
  window.addEventListener("oeg:cycle", (event) => pick(event.detail));
  root.addEventListener("click", (event) => {
    const el = event.target.closest("[data-area]");
    if (el) pick(el.dataset.area);
  });
  root.addEventListener("keydown", (event) => {
    const el = event.target.closest(".ccFlag");
    if (el && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      pick(el.dataset.area);
    }
  });

  async function load() {
    try {
      const cli = await json("/api/macro/regional?id=ocde_cli");
      areas = Object.fromEntries(
        Object.entries(cli.areas)
          .filter(([k, a]) => NAMES[k] && a.history?.length > 2 && !a.stale)
          .map(([k, a]) => [k, { points: track(a.history) }]),
      );
      const last = Object.values(areas).map((a) => a.points.at(-1).date).sort().at(-1);
      root.querySelector(".ccStamp").textContent = last ? "OCDE · referência " + month(last) : "OCDE";
      draw();
    } catch {
      plot.innerHTML = '<p class="empty">Indicador antecedente indisponível no momento.</p>';
    }
  }
  load();
  setInterval(load, 3600000);
}

// Sinal de recessão: diferença entre os juros de 10 e 2 anos dos EUA desde o início da série.
export function recessionSignal({ root }) {
  async function load() {
    try {
      const curve = await json("/api/macro/curva");
      const pts = (curve.spread_history?.["10A-2A"] || []).map(([d, v]) => [d, Number(v)]);
      if (pts.length < 2) return;
      const W = 560;
      const H = 120;
      const L = 30;
      const B = 18;
      const T = 8;
      const vals = pts.map(([, v]) => v);
      const hi = Math.max(...vals, 0.2);
      const lo = Math.min(...vals, -0.2);
      const t0 = Date.parse(pts[0][0]);
      const t1 = Date.parse(pts.at(-1)[0]);
      const x = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - 4);
      const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
      const line = pts.map(([d, v], i) => (i ? "L" : "M") + x(d).toFixed(1) + " " + y(v).toFixed(1)).join("");
      const area = line + "L" + x(pts.at(-1)[0]).toFixed(1) + " " + y(0).toFixed(1) + "L" + x(pts[0][0]).toFixed(1) + " " + y(0).toFixed(1) + "Z";
      const inverted = pts.filter(([, v]) => v < 0).length;
      const years = [...new Set(pts.map(([d]) => d.slice(0, 4)))];
      root.innerHTML =
        '<div class="rsHead"><h3>Sinal de recessão · 10 anos − 2 anos</h3><span>' +
        (inverted ? inverted + " dias com curva invertida no período" : "Nenhum dia com curva invertida no período") + "</span></div>" +
        '<svg class="rsChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Diferença entre os juros de 10 e 2 anos dos EUA">' +
        '<defs><clipPath id="rsUp"><rect x="0" y="0" width="' + W + '" height="' + y(0).toFixed(1) + '"/></clipPath><clipPath id="rsDown"><rect x="0" y="' +
        y(0).toFixed(1) + '" width="' + W + '" height="' + H + '"/></clipPath></defs>' +
        '<path class="rsArea up" clip-path="url(#rsUp)" d="' + area + '"/><path class="rsArea down" clip-path="url(#rsDown)" d="' + area + '"/>' +
        '<path class="rsZero" d="M' + L + " " + y(0).toFixed(1) + "H" + W + '"/><path class="rsLine" d="' + line + '"/>' +
        '<text class="rsAxis" x="' + (L - 4) + '" y="' + (y(hi) + 4).toFixed(1) + '">' + nf2.format(hi) + '</text><text class="rsAxis" x="' + (L - 4) + '" y="' +
        (y(0) + 3).toFixed(1) + '">0</text>' +
        years.map((yr) => {
          const first = pts.find(([d]) => d.startsWith(yr))[0];
          return '<text class="rsYear" x="' + x(first).toFixed(1) + '" y="' + (H - 4) + '">' + yr + "</text>";
        }).join("") +
        "</svg>" +
        '<p class="sourceNote">Acima de zero, os juros longos pagam mais que os curtos (normal). Abaixo de zero, a curva está invertida, sinal que antecedeu as últimas recessões americanas. Hoje: <b>' +
        nf2.format(pts.at(-1)[1]) + " p.p.</b></p>";
    } catch {
      root.innerHTML = "";
    }
  }
  load();
  setInterval(load, 3600000);
}
