// Força das moedas e matriz cruzada, calculadas pelo Observatório com as referências
// diárias do BCE. Cada moeda é comparada com todas as outras no período escolhido;
// a força é a média dessas variações. Um clique na matriz abre o par no comparador.
import { coin } from "./symbols.js";
import { cachedFetch } from "./data.js";
import { esc, dayMonth as day, failure } from "./format.js";

const PERIODS = { day: [1, "no dia", 7], week: [5, "na semana", 7], month: [21, "no mês", 30], quarter: [Infinity, "em 3 meses", 90] };
const NAMES = {
  USD: "Dólar americano", EUR: "Euro", JPY: "Iene", GBP: "Libra", AUD: "Dólar australiano", CAD: "Dólar canadense",
  CNY: "Yuan", HKD: "Dólar de Hong Kong", INR: "Rúpia indiana", BRL: "Real",
};
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const pct1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });

// Valor de cada moeda em dólares, por data, a partir das séries "moeda por USD".
export function usdValues(series) {
  const dates = new Set();
  for (const s of Object.values(series)) for (const [d] of s.history) dates.add(d);
  const common = [...dates].sort().filter((d) => Object.values(series).every((s) => s.history.some(([x]) => x === d)));
  const out = { USD: common.map(() => 1) };
  for (const [code, s] of Object.entries(series)) {
    const map = new Map(s.history.map(([d, v]) => [d, Number(v)]));
    out[code] = common.map((d) => 1 / map.get(d));
  }
  return { dates: common, values: out };
}

// Variação de A contra B entre dois índices: positiva = A se valorizou frente a B.
export function cross(values, a, b, from, to) {
  return ((values[a][to] / values[b][to]) / (values[a][from] / values[b][from]) - 1) * 100;
}

export function strength(values, from, to) {
  const codes = Object.keys(values);
  return codes
    .map((a) => ({
      code: a,
      value: codes.filter((b) => b !== a).reduce((s, b) => s + cross(values, a, b, from, to), 0) / (codes.length - 1),
      path: values[a].slice(from, to + 1).map((v, i, all) => {
        // Força acumulada no período, para a mini linha.
        const others = codes.filter((b) => b !== a);
        return others.reduce((s, b) => s + cross(values, a, b, from, from + i), 0) / others.length;
      }),
    }))
    .sort((x, y) => y.value - x.value);
}

function line(points) {
  if (points.length < 2) return "";
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const span = max - min || 1;
  const y = (v) => (22 - ((v - min) / span) * 20).toFixed(1);
  return (
    '<svg class="fxLine" viewBox="0 0 60 24" preserveAspectRatio="none" aria-hidden="true"><path class="zero" d="M0 ' + y(0) + 'H60"/>' +
    '<path d="' + points.map((v, i) => (i ? "L" : "M") + ((i / (points.length - 1)) * 60).toFixed(1) + " " + y(v)).join("") + '"/></svg>'
  );
}

export function fxBoard({ root, read, save }) {
  const $ = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll("[data-fx-period]")];
  let period = PERIODS[read("fxPeriod", "week")] ? read("fxPeriod", "week") : "week";
  let data = null;

  function draw() {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.fxPeriod === period));
    if (!data || data.dates.length < 2) return;
    const [steps, label] = PERIODS[period];
    const to = data.dates.length - 1;
    const from = Math.max(0, to - steps);
    const rank = strength(data.values, from, to);
    const max = Math.max(...rank.map((r) => Math.abs(r.value)), 0.01);
    const best = rank[0];
    const worst = rank.at(-1);
    const brl = rank.find((r) => r.code === "BRL");
    $("#fxRead").innerHTML =
      "De " + esc(day(data.dates[from])) + " a " + esc(day(data.dates[to])) + ", a moeda mais forte foi " + coin(best.code) + " <b>" +
      esc(NAMES[best.code] || best.code) + '</b> (<b data-tone="pos">' + pct.format(best.value) + "%</b>) e a mais fraca, " + coin(worst.code) +
      " <b>" + esc(NAMES[worst.code] || worst.code) + '</b> (<b data-tone="neg">' + pct.format(worst.value) + "%</b>)." +
      (brl && brl !== best && brl !== worst
        ? " O real ficou em " + (rank.indexOf(brl) + 1) + "º de " + rank.length + "."
        : "");
    $("#fxRank").innerHTML =
      '<ol class="fxRank">' +
      rank
        .map((r, i) =>
          '<li data-tone="' + (r.value > 0 ? "pos" : r.value < 0 ? "neg" : "flat") + '"><span class="fxPos">' + (i + 1) + "</span>" + coin(r.code) +
          '<span class="fxCode"><strong>' + r.code + "</strong><small>" + esc(NAMES[r.code] || "") + '</small></span><span class="fxBar"><i style-w="' +
          ((Math.abs(r.value) / max) * 50).toFixed(1) + '" data-side="' + (r.value < 0 ? "neg" : "pos") + '"></i></span>' + line(r.path) +
          "<b>" + pct.format(r.value) + "%</b></li>")
        .join("") +
      "</ol>";
    // Matriz na ordem do ranking: mais fortes em cima e à esquerda.
    const codes = rank.map((r) => r.code);
    const cells = codes.map((a) => codes.map((b) => (a === b ? null : cross(data.values, a, b, from, to))));
    const cmax = Math.max(...cells.flat().filter((v) => v != null).map(Math.abs), 0.01);
    $("#fxMatrix").innerHTML =
      '<table class="fxMatrix"><caption>Variação da moeda da linha contra a da coluna ' + esc(label) + '</caption><thead><tr><th></th>' +
      codes.map((c) => '<th scope="col">' + coin(c) + "<span>" + c + "</span></th>").join("") + "</tr></thead><tbody>" +
      codes
        .map((a, i) =>
          '<tr><th scope="row">' + coin(a) + "<span>" + a + "</span></th>" +
          cells[i]
            .map((v, j) =>
              v == null
                ? '<td class="self"></td>'
                : '<td><button data-a="' + a + '" data-b="' + codes[j] + '" data-tone="' + (v > 0 ? "pos" : v < 0 ? "neg" : "flat") + '" data-level="' +
                  Math.min(5, Math.ceil((Math.abs(v) / cmax) * 5)) + '" title="' + esc(a + " contra " + codes[j] + ": " + pct.format(v) + "% " + label) +
                  '">' + pct1.format(v) + "</button></td>")
            .join("") +
          "</tr>")
        .join("") +
      "</tbody></table>";
    for (const el of root.querySelectorAll("[style-w]")) {
      el.style.width = el.getAttribute("style-w") + "%";
      el.style[el.dataset.side === "neg" ? "right" : "left"] = "50%";
      el.removeAttribute("style-w");
    }
  }

  // Abre o par no comparador (que compara dólar contra cada moeda).
  $("#fxMatrix").addEventListener("click", (event) => {
    const cell = event.target.closest("button[data-a]");
    if (!cell) return;
    const a = document.querySelector("#compareA");
    const b = document.querySelector("#compareB");
    const days = document.querySelector("#compareDays");
    const has = (sel, code) => [...sel.options].some((o) => o.value === code);
    const [x, y] = [cell.dataset.a, cell.dataset.b];
    const first = x === "USD" ? y : x;
    const second = x === "USD" || y === "USD" ? null : y;
    if (has(a, first)) {
      a.value = first;
      a.dispatchEvent(new Event("change"));
    }
    if (second && has(b, second) && second !== a.value) {
      b.value = second;
      b.dispatchEvent(new Event("change"));
    }
    days.value = String(PERIODS[period][2]);
    days.dispatchEvent(new Event("change"));
    location.hash = "#comparison";
  });

  for (const t of tabs)
    t.addEventListener("click", () => {
      period = t.dataset.fxPeriod;
      save("fxPeriod", period);
      draw();
    });

  async function load() {
    try {
      const r = await cachedFetch("/api/atlas?base=USD");
      if (!r.ok) throw Error();
      const body = await r.json();
      data = usdValues(body.series);
      const last = data.dates.at(-1);
      $("#fxStamp").textContent = last ? "BCE · referência de " + day(last) + "/" + last.slice(0, 4) : "BCE";
      draw();
    } catch {
      $("#fxRank").innerHTML = failure("Referências cambiais");
    }
  }
  draw();
  load();
  setInterval(load, 1800000);
}
