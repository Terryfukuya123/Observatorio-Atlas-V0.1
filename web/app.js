import { makeMap, svg, euro } from "./map.js";
import { renderBulletin, renderLocalBulletin } from "./bulletin.js";
import { comparison } from "./comparison.js";
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
const compare = comparison({ read, save, fmt, timestamp });
const icons = {
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 8h5v5H6zM14 8h4m-4 4h4M6 16h12"/>',
  calendar:
    '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 3v5m10-5v5M3 11h18m-14 4h3m3 0h3"/>',
  rail: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-11 3 3-3 3"/>',
  chart: '<path d="M3 3v17h18M5 15l5-6 4 3 6-8"/>',
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
function setRail(expanded) {
  document.documentElement.dataset.rail = expanded ? "wide" : "compact";
  const label = expanded ? "Recolher navegação" : "Expandir navegação";
  $("#railToggle").setAttribute("aria-expanded", String(expanded));
  $("#railToggle").setAttribute("aria-label", label);
  $("#railToggle").title = label;
}
setRail(read("rail", "compact") === "wide");
$("#railToggle").onclick = () => {
  const expanded = document.documentElement.dataset.rail !== "wide";
  setRail(expanded);
  save("rail", expanded ? "wide" : "compact");
};
function markSection() {
  const target =
    ["#markets", "#comparison", "#bulletin"].find(
      (id) => $(id).getBoundingClientRect().top <= 24,
    ) || "#top";
  for (const link of document.querySelectorAll("#sections a")) {
    const active = link.hash === target;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("scroll", markSection, { passive: true });
window.addEventListener("hashchange", markSection);
markSection();
const state = {
  id: read("country", "BRA"),
  layer: ["coverage", "daily", "heat"].includes(read("mapLayer", "daily"))
    ? read("mapLayer", "daily")
    : "daily",
  region: read("region", ""),
  period: read("period", "30"),
  geo: new Map(),
  markets: {},
  crosses: {},
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
      (state.crosses[m.currency]
        ? fact(
            state.crosses[m.currency].instrument + " · calculado",
            number(state.crosses[m.currency].value),
          )
        : "") +
      (s
        ? fact("Coleta · BRT", timestamp(s.received).replace(" BRT", ""))
        : "") +
      '<details class="coverageNotes"><summary>Cobertura de outros indicadores</summary>' +
      fact(
        m.index || "Índice de bolsa",
        m.index ? "Uso não autorizado" : "Sem cobertura",
      ) +
      fact("Juros e inflação", "Sem cobertura") +
      fact("Sessão de bolsa", "Não verificada") +
      "</details>" +
      '</div><div class="detailActions">' +
      (s ? '<button id="compareMarket">Comparar este par →</button>' : "") +
      '<button class="contextlink" id="record">Origem e método</button></div>',
  );
  $("#record").onclick = openMeta;
  if ($("#compareMarket"))
    $("#compareMarket").onclick = () => compare.pick(m.series);
}
function renderAll() {
  $("#healthText").textContent =
    state.source.status === "Atualizado"
      ? "BCE atualizado"
      : state.source.status;
  $("#health").dataset.ok = state.source.status === "Atualizado" ? "yes" : "no";
  renderTicker();
  detail();
  renderLocalBulletin(
    info(state.id).name,
    euro.has(state.id) ? "EMU" : state.id,
  );
  renderTable();
  renderMap();
}
function renderMap() {
  const daily = state.layer !== "coverage";
  const heat = state.layer === "heat";
  $("#heatView").hidden = !heat;
  $("#map").toggleAttribute("hidden", heat);
  $(".maptools").hidden = heat;
  $(".credit").hidden = heat;
  const values = new Map(
    Object.entries(state.markets)
      .filter(([, market]) => state.series[market.series])
      .map(([id, market]) => [id, state.series[market.series]]),
  );
  const lastDate = Object.values(state.series)
    .map((s) => s.observed)
    .sort()
    .at(-1);
  $("#map").dataset.layer = state.layer;
  for (const btn of document.querySelectorAll("button[data-layer]"))
    btn.setAttribute("aria-pressed", String(btn.dataset.layer === state.layer));
  $("#mapScope").textContent = daily
    ? "Alta do par = euro mais forte"
    : "Referências do BCE";
  const keys = daily
    ? [
        ["up", "Alta do par"],
        ["down", "Baixa do par"],
        ["flat", "Estável"],
        ["none", "Sem variação válida"],
      ]
    : [
        ["sel", "Seleção"],
        ["cov", "Com dados"],
        ["none", "Sem cobertura"],
      ];
  $("#mapLegend").innerHTML = keys
    .map(
      ([cls, label]) =>
        '<span><b class="swatch ' + cls + '"></b>' + label + "</span>",
    )
    .join("");
  if (heat) renderHeatmap(lastDate);
  map?.draw(state.id, values, state.layer, lastDate);
}
function renderHeatmap(lastDate) {
  const included = new Map();
  for (const [id, market] of Object.entries(state.markets)) {
    if (state.region && market.region !== state.region) continue;
    if (!included.has(market.series) || id === state.id)
      included.set(market.series, id);
  }
  $("#heatDate").textContent = lastDate
    ? "BCE · " + fmt(lastDate)
    : "Sem observação disponível";
  const pct = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "exceptZero",
  });
  const tiles = [...included]
    .map(([code, id]) => {
      const s = state.series[code];
      const change =
        s?.status === "Atualizado" &&
        s.observed === lastDate &&
        s.change?.to === lastDate
          ? s.change.percent
          : null;
      const dir = !Number.isFinite(change)
        ? "missing"
        : change === 0
          ? "flat"
          : change > 0
            ? "up"
            : "down";
      const level =
        dir === "missing"
          ? ""
          : Math.abs(change) >= 1
            ? "strong"
            : Math.abs(change) >= 0.25
              ? "medium"
              : "soft";
      return (
        '<button class="tile ' +
        dir +
        " " +
        level +
        '" data-heat-pick="' +
        escape(id) +
        '"><strong>EUR/' +
        escape(code) +
        "</strong><b>" +
        (Number.isFinite(change) ? pct.format(change) + "%" : "—") +
        "</b><small>" +
        escape(
          Number.isFinite(change) ? info(id).name : "Sem variação válida",
        ) +
        "</small></button>"
      );
    })
    .join("");
  $("#heatTiles").innerHTML =
    tiles || '<p class="empty">Sem pares cadastrados nesta região.</p>';
}
$("#heatTiles").addEventListener("click", (e) => {
  const tile = e.target.closest("button[data-heat-pick]");
  if (!tile) return;
  state.layer = "daily";
  save("mapLayer", "daily");
  document.querySelector('button[data-sheet="market"]').click();
  select(tile.dataset.heatPick, true);
  document
    .querySelector('button[data-layer="daily"]')
    .focus({ preventScroll: true });
});
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
  const cross = state.crosses[info(state.id).currency];
  if (cross)
    html +=
      "<p><strong>" +
      escape(cross.instrument) +
      " · cálculo do Observatório</strong><br>" +
      escape(cross.unit) +
      " · " +
      fmt(cross.observed) +
      " · " +
      escape(cross.status) +
      ". Séries BCE: " +
      escape(cross.inputs.join(", ")) +
      ". Taxa da moeda local por EUR dividida por USD por EUR; para EUR usa-se o inverso de EUR/USD. Exibição com cinco casas decimais.</p>";
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
for (const btn of document.querySelectorAll("button[data-layer]")) {
  btn.onclick = () => {
    state.layer = btn.dataset.layer;
    save("mapLayer", state.layer);
    renderMap();
  };
}
if (document.fullscreenEnabled) {
  $("#expandAtlas").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $(".workspace").requestFullscreen();
    } catch {
      $("#expandAtlas").title = "Tela cheia indisponível neste navegador";
    }
  };
  document.addEventListener("fullscreenchange", () => {
    const label = document.fullscreenElement
      ? "Sair da tela cheia"
      : "Ampliar atlas";
    $("#expandAtlas").setAttribute("aria-label", label);
    $("#expandAtlas").title = label;
  });
} else $("#expandAtlas").hidden = true;
renderBulletin();
for (const btn of document.querySelectorAll("button[data-sheet]")) {
  btn.onclick = () => {
    const news = btn.dataset.sheet === "news";
    $("#detail").hidden = news;
    $("#localBulletin").hidden = !news;
    for (const item of document.querySelectorAll("button[data-sheet]"))
      item.setAttribute("aria-pressed", String(btn === item));
  };
}
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
      crosses: data.usd_crosses || {},
      series: data.series,
      source: data.source,
    });
  } catch {
    state.series = {};
    state.crosses = {};
    state.source = {
      status: "Fonte indisponível",
      error: "API local indisponível",
    };
  }
  compare.refresh(state.series);
  const observed = Object.values(state.series)
    .map((s) => s.observed)
    .sort()
    .at(-1);
  $("#edition").textContent = observed
    ? "Câmbio de referência · BCE · Última observação em " + fmt(observed)
    : "Câmbio de referência · BCE · Sem observação disponível";
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
