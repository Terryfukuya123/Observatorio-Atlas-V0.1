import { makeMap, svg } from "./map.js";
const $ = (s) => document.querySelector(s);
const fmt = (s) =>
  s
    ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4)
    : "Sem observação";
const timestamp = (s) =>
  s
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(s)) + " BRT"
    : "Indisponível";
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const plain = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const read = (k, d) => {
  try {
    return localStorage.getItem("oeg." + k) || d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem("oeg." + k, v);
  } catch {}
};
const icons = {
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.5" ry="9"/><path d="M3 12h18"/>',
  fit: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
};
$("html").dataset.theme = read("theme", "dark");
for (const i of document.querySelectorAll("[data-icon]"))
  i.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' +
    icons[i.dataset.icon] +
    "</svg>";
$("#theme").onclick = () => {
  const t = $("html").dataset.theme === "light" ? "dark" : "light";
  $("html").dataset.theme = t;
  save("theme", t);
};
const state = {
  id: read("country", "BRA"),
  region: read("region", ""),
  period: read("period", "30"),
  geo: new Map(),
  markets: {},
  series: {},
  source: { status: "Consultando fonte" },
};
let map;
const regions = [...$("#region").options].map((o) => o.value).filter(Boolean);
if (!regions.includes(state.region)) state.region = "";
if (!["7", "30", "90"].includes(state.period)) state.period = "30";
const focusCodes = ["USA", "BRA", "JPN", "GBR"];
const names = {
  USD: "Dólar americano",
  BRL: "Real brasileiro",
  JPY: "Iene japonês",
  GBP: "Libra esterlina",
};
function info(id) {
  return state.markets[id] || state.geo.get(id) || { name: id, region: "" };
}
function current() {
  return state.series[state.markets[state.id]?.series];
}
function missing(market) {
  return market?.series
    ? state.source.error
      ? "Fonte indisponível"
      : "Sem observação"
    : "Sem cobertura";
}
function number(raw) {
  return raw == null ? "—" : String(raw).replace(".", ",");
}
function delta(change) {
  if (!change) return '<span class="delta muted">—</span>';
  const val = change.percent;
  const label =
    (val > 0 ? "+" : "") +
    val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    "%";
  return (
    '<span class="delta ' +
    (val > 0 ? "positive" : val < 0 ? "negative" : "muted") +
    '" title="Variação do par calculada pelo Observatório, de ' +
    fmt(change.from) +
    " a " +
    fmt(change.to) +
    '">' +
    label +
    "</span>"
  );
}
function plot(el, points, area = false) {
  if (!el || !points.length) return;
  const w = 240,
    h = 53,
    pad = 3,
    values = points.map((r) => Number(r[1])),
    low = Math.min(...values),
    high = Math.max(...values);
  const plotWidth = area ? w - 43 : w;
  const times = points.map((r) => Date.parse(r[0] + "T00:00:00Z"));
  const xy = values.map((v, i) => [
    pad +
      ((plotWidth - 2 * pad) * (times[i] - times[0])) /
        (times.at(-1) - times[0] || 1),
    high === low ? h / 2 : pad + ((h - 2 * pad) * (high - v)) / (high - low),
  ]);
  el.setAttribute("viewBox", "0 0 " + w + " " + h);
  el.setAttribute("preserveAspectRatio", "none");
  const d = "M" + xy.map((p) => p.join(",")).join("L");
  if (area) {
    for (const y of [4, 26, 50])
      el.append(
        svg("path", {
          d: "M0 " + y + "H" + plotWidth,
          stroke: "var(--border)",
          "stroke-dasharray": "3 4",
        }),
      );
    for (const [value, y] of low === high
      ? [[low, 29]]
      : [
          [high, 9],
          [low, h - 2],
        ]) {
      const label = svg("text", {
        x: w - 1,
        y,
        "text-anchor": "end",
        class: "plotTick",
      });
      label.textContent = number(points[values.indexOf(value)][1]);
      el.append(label);
    }
    el.append(
      svg("path", {
        d: d + "L" + xy.at(-1)[0] + "," + h + "L" + xy[0][0] + "," + h + "Z",
        fill: "currentColor",
        opacity: ".10",
      }),
    );
  }
  el.append(
    svg("path", {
      d,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": area ? 1.8 : 1.3,
      "vector-effect": "non-scaling-stroke",
      "stroke-linejoin": "round",
    }),
  );
}
function renderTicker() {
  $("#ticker").innerHTML = focusCodes
    .map((id) => {
      const m = state.markets[id],
        s = state.series[m?.series],
        code =
          m?.series || { USA: "USD", BRA: "BRL", JPN: "JPY", GBR: "GBP" }[id];
      return (
        '<button class="tick" data-pick="' +
        id +
        '"><div class="ticktop"><span class="pair">EUR / ' +
        code +
        '</span><span class="tickname">' +
        names[code] +
        '</span></div><div class="tickmain"><span class="rate">' +
        number(s?.value) +
        "</span>" +
        delta(s?.change) +
        '<svg class="spark" aria-hidden="true"></svg></div><div class="ticknote">' +
        (s ? "BCE · " + fmt(s.observed) + " · " + s.status : missing(m)) +
        "</div></button>"
      );
    })
    .join("");
  document.querySelectorAll(".tick").forEach((btn) => {
    const s = state.series[state.markets[btn.dataset.pick]?.series];
    if (s) plot(btn.querySelector("svg"), s.history.slice(-18));
  });
}
function renderTable() {
  const entries = Object.entries(state.markets).filter(
    ([, m]) => !state.region || m.region === state.region,
  );
  $("#count").textContent = entries.length + " mercados";
  $("#rows").innerHTML = entries.length
    ? entries
        .map(([id, m]) => {
          const s = state.series[m.series];
          return (
            '<tr class="' +
            (id === state.id ? "chosen" : "") +
            '"><td><button data-pick="' +
            id +
            '"><span class="tablecode">' +
            id +
            "</span>" +
            escape(m.name) +
            "</button></td><td>" +
            escape(m.index) +
            "</td><td>EUR/" +
            m.series +
            "</td><td>" +
            number(s?.value) +
            "</td><td>" +
            delta(s?.change) +
            "</td><td>" +
            (s ? fmt(s.observed) + " · " + s.status : missing(m)) +
            "</td></tr>"
          );
        })
        .join("")
    : '<tr><td colspan="6">Sem mercados acompanhados nesta região.</td></tr>';
}
function select(id, scroll = false) {
  if (!state.geo.has(id) && !state.markets[id]) return;
  state.id = id;
  save("country", id);
  if (state.region && info(id).region !== state.region) {
    state.region = "";
    save("region", "");
    $("#region").value = "";
    map?.region("");
  }
  renderAll();
  if (scroll) $(".context").scrollIntoView({ block: "nearest" });
}
function chooseRegion(name) {
  state.region = name;
  save("region", name);
  $("#region").value = name;
  map?.region(name);
  if (name && info(state.id).region !== name) {
    const first =
      Object.keys(state.markets).find((k) => info(k).region === name) ||
      [...state.geo.keys()].find((k) => info(k).region === name);
    if (first) {
      state.id = first;
      save("country", first);
    }
  }
  renderAll();
}
function detail() {
  const id = state.id,
    m = info(id),
    s = current();
  const fact = (k, v) =>
    '<div class="fact"><b>' +
    escape(k) +
    "</b><span>" +
    escape(v) +
    "</span></div>";
  let html =
    '<div class="countryhead"><span class="code">' +
    escape(id) +
    "</span><div><h2>" +
    escape(m.name) +
    '</h2><div class="minor">' +
    escape(m.region) +
    (m.currency ? " · " + m.currency : "") +
    "</div></div></div>";
  if (s) {
    const end = Date.parse(s.observed + "T00:00:00Z");
    const points = s.history.filter(
      ([d]) =>
        end - Date.parse(d + "T00:00:00Z") < Number(state.period) * 86400000,
    );
    html +=
      '<div class="quotebox"><div class="line"><b class="pair">' +
      s.instrument +
      '</b><span class="minor">Câmbio de referência</span></div><div class="line"><b class="rate">' +
      number(s.value) +
      "</b>" +
      delta(s.change) +
      '</div><div class="minor">BCE · ' +
      fmt(s.observed) +
      " · " +
      s.status +
      '</div></div><div class="chartline"><strong>Histórico cambial</strong><div class="segments">' +
      ["7", "30", "90"]
        .map(
          (n) =>
            '<button data-days="' +
            n +
            '" aria-pressed="' +
            (n === state.period) +
            '">' +
            n +
            "D</button>",
        )
        .join("") +
      '</div></div><svg id="historyPlot" role="img" aria-label="Histórico de ' +
      s.instrument +
      ", em " +
      s.unit +
      '"></svg><div class="dates"><span>' +
      fmt(points[0][0]) +
      "</span><span>" +
      fmt(s.observed) +
      "</span></div>";
    $("#detail").innerHTML = html;
    plot($("#historyPlot"), points, true);
  } else
    $("#detail").innerHTML =
      html +
      '<div class="empty"><b>' +
      escape(missing(m)) +
      "</b><p>Não há referência cambial disponível para esta seleção.</p></div>";
  $("#detail").insertAdjacentHTML(
    "beforeend",
    '<div class="facts">' +
      fact(
        m.index || "Índice de bolsa",
        m.index ? "Uso não autorizado" : "Sem cobertura",
      ) +
      fact("Juros e inflação", "Sem cobertura") +
      fact("Sessão de bolsa", "Não verificada") +
      (s
        ? fact("Coleta · BRT", timestamp(s.received).replace(" BRT", ""))
        : "") +
      '</div><button class="contextlink" id="record">Ver origem e metodologia ↗</button>',
  );
  $("#record").onclick = openMeta;
}
function renderAll() {
  $("#healthText").textContent =
    state.source.status === "Atualizado"
      ? "BCE atualizado"
      : state.source.status;
  $("#health").dataset.ok = state.source.status === "Atualizado" ? "yes" : "no";
  renderTicker();
  detail();
  renderTable();
  map?.draw(
    state.id,
    new Set(
      Object.entries(state.markets)
        .filter(([, m]) => state.series[m.series])
        .map(([k]) => k),
    ),
  );
}
function openMeta() {
  const s = current(),
    h = state.source;
  const entry = (k, v) =>
    "<dt>" + escape(k) + "</dt><dd>" + escape(v) + "</dd>";
  let html =
    '<p>Taxas diárias em unidades da moeda de cotação por euro. Estatísticas do Banco Central Europeu, disponíveis gratuitamente na <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noreferrer">fonte oficial ↗</a>.</p><dl>' +
    entry("Saúde da fonte", h.status + (h.error ? " · " + h.error : "")) +
    entry("Última tentativa", timestamp(h.attempted)) +
    entry("Última coleta válida", timestamp(h.received)) +
    entry(
      "Consultas válidas / tentativas",
      (h.successes || 0) + " / " + (h.attempts || 0),
    ) +
    entry(
      "Latência da última tentativa",
      h.latency_ms == null ? "Indisponível" : h.latency_ms + " ms",
    );
  if (h.cache_warning) html += entry("Persistência", h.cache_warning);
  if (s)
    html +=
      entry(
        "Registro selecionado",
        info(state.id).name +
          " · " +
          s.instrument +
          " · " +
          number(s.value) +
          " " +
          s.unit,
      ) +
      entry(
        "Observação e periodicidade",
        fmt(s.observed) + " · hora não informada pelo BCE · " + s.frequency,
      ) +
      entry("Mercado e sessão", s.market + " · " + s.session) +
      entry(
        "Direito de uso",
        "ECB-REF · reprodução informativa com atribuição e precisão da série",
      ) +
      entry("Identificador SHA-256 do arquivo", h.snapshot);
  html +=
    "</dl><p>A variação diária é calculada pelo Observatório contra a referência do dia útil TARGET anterior. O gráfico apresenta níveis do par. Uma alta indica que um euro compra mais unidades da moeda de cotação.</p><p>O BCE costuma publicar por volta das 16h na Europa Central. A aplicação admite margem até 17h UTC. Falhas identificam a fonte como indisponível e os valores retidos como históricos.</p><p>Para mercados da zona do euro, EUR/USD representa o contexto cambial comum. Os índices listados identificam os mercados. Suas cotações aguardam licença de exibição.</p>";
  if (s)
    html +=
      "<details><summary>Observações diárias · " +
      s.instrument +
      "</summary><table><thead><tr><th>Data BCE</th><th>" +
      s.unit +
      "</th></tr></thead><tbody>" +
      s.history
        .slice()
        .reverse()
        .map(
          ([d, v]) =>
            "<tr><td>" + fmt(d) + "</td><td>" + number(v) + "</td></tr>",
        )
        .join("") +
      "</tbody></table></details>";
  html +=
    '<p><a href="https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html" target="_blank" rel="noreferrer">Política de reutilização do SEBC ↗</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Cartografia Natural Earth ↗</a></p>';
  $("#metaBody").innerHTML = html;
  if (!$("#metadata").open) $("#metadata").showModal();
}
function results() {
  const q = plain($("#query").value.trim());
  const regionHits = regions
    .filter((r) => q && plain(r).includes(q))
    .map(
      (r) =>
        '<button class="result" data-region="' +
        r +
        '"><strong>' +
        r +
        "</strong><small>Região</small></button>",
    );
  const keys = [
    ...new Set([...Object.keys(state.markets), ...state.geo.keys()]),
  ];
  const hits = keys.filter((k) => {
    const m = info(k);
    return plain(
      [
        m.name,
        k,
        m.currency,
        m.index,
        m.market,
        m.series,
        m.series ? "EUR/" + m.series : "",
      ]
        .filter(Boolean)
        .join(" "),
    ).includes(q);
  });
  $("#results").innerHTML =
    regionHits.join("") +
      hits
        .map(
          (k) =>
            '<button class="result" data-pick="' +
            escape(k) +
            '"><strong>' +
            escape(info(k).name) +
            "</strong><small>" +
            escape(info(k).index || info(k).region) +
            "</small></button>",
        )
        .join("") || '<p class="empty">Nenhum mercado encontrado.</p>';
  $("#results").scrollTop = 0;
}
function search() {
  results();
  $("#finder").showModal();
  $("#query").focus();
  $("#query").select();
}
$("#searchOpen").onclick = search;
$("#query").oninput = results;
$("#query").onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#results button")?.click();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    $("#results button")?.focus();
  }
};
$("#region").onchange = (e) => chooseRegion(e.target.value);
for (const id of ["sources", "health", "method"])
  $("#" + id).onclick = openMeta;
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.classList.contains("close")) {
    btn.closest("dialog").close();
    return;
  }
  if (btn.dataset.pick || btn.dataset.region) {
    if ($("#finder").open) $("#finder").close();
    if (btn.dataset.pick) select(btn.dataset.pick, true);
    else chooseRegion(btn.dataset.region);
  }
  if (btn.dataset.days) {
    state.period = btn.dataset.days;
    save("period", state.period);
    detail();
    document.querySelector('[data-days="' + state.period + '"]').focus();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !document.querySelector("dialog[open]") &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    e.preventDefault();
    search();
  }
});
async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}
async function refresh() {
  try {
    const data = await json("/api/atlas");
    Object.assign(state, {
      markets: data.markets,
      series: data.series,
      source: data.source,
    });
  } catch {
    state.series = {};
    state.source = {
      status: "Fonte indisponível",
      error: "API local indisponível",
    };
  }
  if (!state.geo.has(state.id) && !state.markets[state.id]) state.id = "BRA";
  renderAll();
}
try {
  const geo = await json("/world.json");
  state.geo = new Map(geo.map((g) => [g.id, g]));
  map = makeMap(geo, (id) => select(id));
  $("#region").value = state.region;
  map.region(state.region);
} catch {
  $(".canvas").insertAdjacentHTML(
    "afterbegin",
    '<p class="empty">Cartografia indisponível. Use a busca de mercados.</p>',
  );
}
await refresh();
setInterval(refresh, 300000);
