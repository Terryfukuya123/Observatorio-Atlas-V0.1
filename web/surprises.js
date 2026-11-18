// Placar de surpresas: cada dado divulgado contra o consenso do Focus na véspera. Mostra se
// a inflação e o desemprego vêm surpreendendo para cima ou para baixo e se o Copom fez o
// que o mercado esperava. Surpresa padronizada = surpresa ÷ desvio-padrão das projeções.
import { cachedFetch } from "./data.js";
import { esc, failure, MONTHS } from "./format.js";

const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (v) => (v == null ? "—" : n2.format(v) + "%");
const pp = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + n2.format(Math.abs(v)) + " p.p.");
const sd = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + n1.format(Math.abs(v)));
const month = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(2, 4);
const tone = (v) => (v === "acima" ? "neg" : v === "abaixo" ? "pos" : "");
const meeting = (m) => m.slice(1).replace("/", "ª reunião de ");
const short = (m) => m.slice(1).replace("/", "ª de ");

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

function kpi(label, value, note, toneName = "") {
  return '<div class="cpKpi"' + (toneName ? ' data-tone="' + toneName + '"' : "") + "><span>" + esc(label) + "</span><strong>" + esc(value) + "</strong><small>" + note + "</small></div>";
}

function dots(history) {
  return '<span class="spDots">' + history.slice(-12).map((r) =>
    '<i class="spDot" data-v="' + r.verdict.replace(" ", "-") + '" title="' + month(r.period) + ": " + esc(r.verdict) + " (" + pp(r.surprise) + ')"></i>').join("") + "</span>";
}

function board(d) {
  const rows = d.indicators.filter((it) => it.latest);
  return '<table class="tdTable spTable"><thead><tr><th>Indicador</th><th>Mês</th><th>Saiu</th><th>Esperado</th><th>Surpresa</th><th>Desvios</th><th>Últimos 12</th><th>Próximo: consenso</th></tr></thead><tbody>' +
    rows.map((it) => {
      const l = it.latest;
      const s = it.score;
      return "<tr><td>" + esc(it.name) + '<small class="spMonth"> · ' + month(l.period) + "</small></td><td>" + month(l.period) + "</td><td>" + pct(l.actual) + "</td><td>" + pct(l.median) + '</td><td data-tone="' + tone(l.verdict) + '">' + pp(l.surprise) +
        '</td><td data-tone="' + tone(l.verdict) + '">' + sd(l.z) + '</td><td title="' + s.above + " acima, " + s.below + " abaixo, " + s.inline + ' em linha">' + dots(it.history) + "</td><td>" +
        (it.next ? month(it.next.period) + ": " + pct(it.next.median) : "—") + "</td></tr>";
    }).join("") + "</tbody></table>";
}

function indexChart(points) {
  const W = 760, H = 230, L = 40, R = 118, T = 12, B = 24;
  const lim = 2.5;
  const bw = (W - L - R) / points.length;
  const y = (v) => T + ((lim - Math.max(-lim, Math.min(lim, v))) / (2 * lim)) * (H - T - B);
  let out = "";
  for (let v = -2; v <= 2; v++)
    out += '<path class="' + (v ? "cpGrid" : "cpTarget") + '" d="M' + L + " " + y(v).toFixed(1) + "H" + (W - R) + '"/><text class="cpAxis" x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '">' + (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "</text>";
  points.forEach(([m, v], i) => {
    const x = L + i * bw;
    const top = Math.min(y(v), y(0));
    out += '<rect class="spBar" data-tone="' + (v >= 0 ? "neg" : "pos") + '" x="' + (x + 1).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + Math.max(1, Math.abs(y(v) - y(0))).toFixed(1) + '"><title>' + month(m) + ": " + sd(v) + " desvio</title></rect>";
    if (m.endsWith("-01")) out += '<text class="cpYear" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 7) + '">' + m.slice(0, 4) + "</text>";
  });
  const line = points.map(([, , ma], i) => (i ? "L" : "M") + (L + i * bw + bw / 2).toFixed(1) + " " + y(ma).toFixed(1)).join("");
  out += '<path class="cpLine spMa" d="' + line + '"/>';
  const last = points.at(-1);
  out += '<text class="cpTag spMa" x="' + (W - R + 8) + '" y="' + (y(last[2]) + 4).toFixed(1) + '">3 meses ' + sd(last[2]) + "</text>";
  return '<svg class="cpChart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Índice de surpresas da inflação nos últimos 24 meses">' + out + "</svg>";
}

function copomTable(c) {
  const verdict = (m) => (m.verdict === "em linha" ? "como esperado" : m.verdict === "acima" ? "mais duro" : "mais brando");
  const move = (v) => (v == null ? "—" : v === 0 ? "manter" : (v > 0 ? "subir " : "cortar ") + n2.format(Math.abs(v)) + " p.p.");
  return '<table class="tdTable spTable spCopom"><thead><tr><th>Reunião</th><th>Data</th><th>Mercado esperava</th><th>Copom fez</th><th>Selic</th><th>Resultado</th></tr></thead><tbody>' +
    (c.next ? "<tr><td>" + short(c.next.meeting) + "</td><td>próxima</td><td>" + move(c.next.expected) + "</td><td>—</td><td>" + pct(c.next.median) + " esperada</td><td>—</td></tr>" : "") +
    [...c.meetings].reverse().map((m) => "<tr><td>" + short(m.meeting) + "</td><td>" + m.surveyed.split("-").reverse().join("/") + "</td><td>" + move(m.expected) + "</td><td>" + move(m.change) + "</td><td>" + pct(m.decided) +
      '</td><td data-tone="' + (m.verdict === "em linha" ? "" : "neg") + '">' + verdict(m) + "</td></tr>").join("") +
    "</tbody></table>";
}

export function surpriseBoard({ root, read, save }) {
  const tabs = [...root.querySelectorAll("[data-sp-view]")];
  let view = ["placar", "indice", "copom"].includes(read("spView", "placar")) ? read("spView", "placar") : "placar";
  let d = null;

  function draw() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.spView === view));
    if (!d) return;
    const plot = root.querySelector(".spPlot");
    const legend = root.querySelector(".spLegend");
    if (view === "placar") {
      plot.innerHTML = board(d);
      legend.innerHTML = '<span><i class="spDot" data-v="acima"></i>acima do consenso</span><span><i class="spDot" data-v="abaixo"></i>abaixo</span><span><i class="spDot" data-v="em-linha"></i>em linha</span><span>Variação no mês em %; desocupação em % da força de trabalho</span>';
    } else if (view === "indice") {
      plot.innerHTML = d.inflation_index.length ? indexChart(d.inflation_index) : '<p class="empty">Sem surpresas calculadas ainda.</p>';
      legend.innerHTML = "<span>Média das surpresas padronizadas do IPCA e de cinco componentes em cada mês. Barras vermelhas: inflação acima do esperado; verdes: abaixo. Linha: média de 3 meses.</span>";
    } else {
      plot.innerHTML = copomTable(d.copom);
      legend.innerHTML = "<span>Mediana do Focus na véspera de cada reunião contra a meta Selic decidida. Mais duro: juros acima do esperado; mais brando: abaixo.</span>";
    }
  }

  for (const t of tabs)
    t.addEventListener("click", () => {
      view = t.dataset.spView;
      save("spView", view);
      draw();
    });

  async function load() {
    try {
      const res = await json("/api/surpresas");
      d = res.data;
      const ipca = d?.indicators.find((it) => it.id === "ipca");
      if (!ipca?.latest) {
        root.querySelector(".spPlot").innerHTML = '<p class="empty">Coletando as expectativas do Focus…</p>';
        setTimeout(load, 30000);
        return;
      }
      const l = ipca.latest;
      const idx = d.inflation_index.at(-1);
      const last = d.copom.meetings.at(-1);
      const next = d.copom.next;
      const jobs = d.indicators.find((it) => it.id === "desocupacao");
      const trend = idx ? (idx[2] >= 0.5 ? "acima" : idx[2] <= -0.5 ? "abaixo" : "em linha") : null;
      const copomWord = (m) => (m.verdict === "em linha" ? "como esperado" : m.verdict === "acima" ? "mais duro que o esperado" : "mais brando que o esperado");
      const move = (v, rate) => (v === 0 ? "manter a Selic em " + pct(rate) : (v > 0 ? "subir" : "cortar") + " a Selic em " + n2.format(Math.abs(v)) + " p.p., para " + pct(rate));
      root.querySelector(".cpKpis").innerHTML =
        kpi("IPCA de " + month(l.period), pp(l.surprise), "Saiu " + pct(l.actual) + "; o consenso era " + pct(l.median) + ' · <b data-tone="' + tone(l.verdict) + '">' + esc(l.verdict) + "</b>", tone(l.verdict)) +
        kpi("Surpresas da inflação · 3 meses", idx ? sd(idx[2]) + " desvio" : "—", trend ? "Média padronizada do IPCA e componentes: " + '<b data-tone="' + tone(trend) + '">' + esc(trend === "em linha" ? "em linha com o" : trend + " do") + "</b> esperado" : "", tone(trend)) +
        kpi("Copom · " + (last ? meeting(last.meeting) : ""), last ? pct(last.decided) : "—", last ? "Mercado esperava " + pct(last.median) + "; " + copomWord(last) : "") +
        kpi("Próximo IPCA · " + (ipca.next ? month(ipca.next.period) : ""), ipca.next ? pct(ipca.next.median) : "—", ipca.next ? "Consenso do Focus em " + ipca.next.surveyed.split("-").reverse().join("/") + " (" + ipca.next.respondents + " instituições)" : "");
      const s = ipca.score;
      root.querySelector(".cpRead").innerHTML =
        "O IPCA de " + month(l.period) + " saiu em <b>" + pct(l.actual) + "</b>, " + (l.verdict === "em linha" ? "em linha com o" : "<b>" + n2.format(Math.abs(l.surprise)) + " p.p. " + l.verdict + "</b> do") + " consenso de " + pct(l.median) + ". " +
        "Nos últimos " + s.count + " meses, veio acima do esperado " + s.above + " vezes, abaixo " + s.below + " e em linha " + s.inline + ". " +
        (trend ? "Somando os componentes, as surpresas recentes da inflação estão <b>" + (trend === "em linha" ? "em linha com o" : trend + " do") + "</b> esperado. " : "") +
        (jobs?.latest ? "A desocupação de " + month(jobs.latest.period) + " ficou " + (jobs.latest.verdict === "em linha" ? "em linha" : jobs.latest.verdict + " do esperado") + " (" + pct(jobs.latest.actual) + "). " : "") +
        (last ? "Na última reunião, o Copom decidiu " + move(last.change, last.decided) + ", " + copomWord(last) + (last.verdict === "em linha" ? "" : " (o mercado esperava " + pct(last.median) + ")") + ". " : "") +
        (next ? "Para a próxima, o mercado espera " + move(next.expected, next.median) + "." : "");
      root.querySelector(".spStamp").textContent = "Focus de " + (ipca.next?.surveyed || l.surveyed).split("-").reverse().join("/");
      draw();
    } catch {
      root.querySelector(".spPlot").innerHTML = failure("o placar de surpresas");
    }
  }
  draw();
  load();
  setInterval(load, 1800000);
}
