// Camada macro: painel Brasil, expectativas Focus, curva dos EUA, ciclo OCDE,
// bloco macro da ficha do país e camada de indicadores do mapa.
import { svg } from "./map.js";
import { round } from "./symbols.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const nf = (value, digits = 2) =>
  Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const day = (iso) =>
  iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—";
const localDay = (stamp) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(stamp));
const month = (iso) => {
  const names = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");
  return iso ? names[Number(iso.slice(5, 7)) - 1] + "/" + iso.slice(0, 4) : "—";
};

// Valor legível com a unidade do catálogo, sem perder a precisão publicada.
export function human(raw, unit = "", digits = 2) {
  if (raw == null || raw === "") return "—";
  const v = Number(raw);
  const big = (n, prefix) =>
    Math.abs(n) >= 1e12
      ? prefix + nf(n / 1e12, 2) + " tri"
      : Math.abs(n) >= 1e9
        ? prefix + nf(n / 1e9, 1) + " bi"
        : Math.abs(n) >= 1e6
          ? prefix + nf(n / 1e6, 1) + " mi"
          : prefix + nf(n, 0);
  if (unit === "R$ milhões") return big(v * 1e6, "R$ ");
  if (unit === "US$ milhões") return big(v * 1e6, "US$ ");
  if (unit === "US$ bilhões") return big(v * 1e9, "US$ ");
  if (unit === "US$") return big(v, "US$ ");
  if (unit === "habitantes") return big(v, "");
  if (unit.startsWith("%") || unit.startsWith("% ")) return nf(v, digits) + "%";
  if (unit.startsWith("R$/US$")) return "R$ " + nf(v, digits);
  return nf(v, digits);
}

function signed(delta, unit, digits) {
  const v = Number(delta);
  if (!Number.isFinite(v)) return "";
  const pp = unit.startsWith("%");
  const money = /milhões|bilhões|^US\$$/.test(unit);
  const text =
    (v > 0 ? "+" : v < 0 ? "−" : "") +
    (money ? human(Math.abs(v), unit, digits) : nf(Math.abs(v), digits)) +
    (pp ? " p.p." : "");
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "■";
  return '<span class="macroDelta" data-dir="' + (v > 0 ? "up" : v < 0 ? "down" : "flat") + '">' + arrow + " " + text + "</span>";
}

function spark(points, label) {
  const el = svg("svg", { class: "spark", role: "img", "aria-label": label, viewBox: "0 0 120 32", preserveAspectRatio: "none" });
  const values = points.map((p) => Number(p[1])).filter(Number.isFinite);
  if (values.length < 2) return el;
  const low = Math.min(...values),
    high = Math.max(...values);
  const xy = values.map((v, i) => [
    (118 * i) / (values.length - 1) + 1,
    high === low ? 16 : 3 + (26 * (high - v)) / (high - low),
  ]);
  el.append(
    svg("path", {
      d: "M" + xy.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L"),
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.4,
      "vector-effect": "non-scaling-stroke",
      "stroke-linejoin": "round",
    }),
  );
  el.append(svg("circle", { cx: xy.at(-1)[0], cy: xy.at(-1)[1], r: 2.2, fill: "currentColor" }));
  return el;
}

const credit = (item) =>
  '<a href="' + esc(item.dataset || item.license_url) + '" target="_blank" rel="noreferrer">' + esc(item.source) + "</a>";

const BRAZIL_GROUPS = [
  ["Juros e câmbio", ["selic_meta", "selic_efetiva", "ptax:USD", "ptax:EUR"]],
  ["Atividade", ["pib_trimestre", "pib_trimestre_ano", "ibcbr", "industria_ano", "varejo_ano", "servicos_ano"]],
  ["Inflação", ["ipca_mes", "ipca_12m", "igpm_mes"]],
  ["Trabalho e crédito", ["desocupacao", "credito", "inadimplencia"]],
  ["Fiscal e setor externo", ["dbgg", "dlsp", "reservas"]],
];

export function macroLayer({ onIndicator }) {
  let overview = null;
  const indicatorCache = new Map();
  const countryCache = new Map();

  async function json(url) {
    const r = await fetch(url);
    if (!r.ok) throw Error("Falha de leitura");
    return r.json();
  }

  function brazilItems() {
    const items = new Map();
    for (const s of overview.brasil.concat(overview.ibge)) items.set(s.id, s);
    for (const [code, p] of Object.entries(overview.ptax))
      items.set("ptax:" + code, {
        ...p,
        id: "ptax:" + code,
        name: "PTAX " + p.instrument,
        unit: "R$",
        decimals: 4,
        frequency: "Dias úteis",
        previous: p.history?.length > 1 ? { value: p.history.at(-2)[1], delta: String(Number(p.value) - Number(p.history.at(-2)[1])) } : null,
      });
    return items;
  }

  function tile(s) {
    const period = s.period || (s.frequency === "Mensal" ? month(s.observed) : day(s.observed));
    const unit = s.unit === "R$" ? "" : s.unit;
    const shown = s.unit === "R$" ? "R$ " + nf(s.value, 4) : human(s.value, s.unit, s.decimals);
    const status = s.collection?.status;
    const card = document.createElement("article");
    card.className = "macroTile";
    card.dataset.series = s.id;
    card.innerHTML =
      "<h4>" + esc(s.name) + "</h4>" +
      '<div class="macroValue"><b>' + esc(shown) + "</b>" +
      (s.previous ? signed(s.previous.delta, s.unit === "R$" ? "" : s.unit, s.unit === "R$" ? 4 : s.decimals) : "") +
      "</div>" +
      '<div class="macroMeta"><span>' + esc(period) + "</span><span>" + esc(unit) + "</span></div>" +
      (status && status !== "Atualizado" ? '<div class="macroWarn">' + esc(status) + "</div>" : "");
    if (s.history?.length > 1) card.append(spark(s.history, "Histórico de " + s.name));
    return card;
  }

  function renderBrazil() {
    const root = document.querySelector("#brasilGroups");
    if (!root) return;
    if (!overview) {
      root.innerHTML = '<p class="empty">Painel macro indisponível no momento.</p>';
      return;
    }
    const items = brazilItems();
    root.replaceChildren();
    for (const [title, ids] of BRAZIL_GROUPS) {
      const group = document.createElement("section");
      group.className = "macroGroup card";
      if (ids.length > 4) group.dataset.wide = "yes";
      group.innerHTML = '<div class="cardhead"><div class="headtitle"><h3>' + esc(title) + "</h3></div></div>";
      const grid = document.createElement("div");
      grid.className = "macroTiles";
      for (const id of ids) {
        const s = items.get(id);
        if (s?.value != null) grid.append(tile(s));
      }
      group.append(grid);
      root.append(group);
    }
    const dates = [...items.values()].map((s) => s.collection?.received).filter(Boolean).sort();
    document.querySelector("#brasilStamp").textContent = dates.length
      ? "BCB e IBGE · coleta mais recente em " + localDay(dates.at(-1))
      : "BCB e IBGE";
    renderFocus();
    const sgs = overview.brasil[0], ibge = overview.ibge[0], ptax = overview.ptax.USD, focus = overview.focus;
    document.querySelector("#brasilSources").innerHTML =
      "Fontes: " + [sgs, ptax, focus, ibge].filter(Boolean).map(credit).join(" · ") +
      ". BCB sob licença ODbL; IBGE citado como fonte. Variações contra a observação anterior calculadas pelo Observatório.";
  }

  function renderFocus() {
    const el = document.querySelector("#focusTable");
    const focus = overview.focus;
    if (!el || !focus?.indicators?.length) return;
    const years = [...new Set(focus.indicators.flatMap((i) => i.years.map((y) => y.year)))].sort().slice(0, 3);
    const trend = (t) =>
      !t || t.direction === "estável" || !t.weeks
        ? '<span class="focusTrend" data-dir="flat">=</span>'
        : '<span class="focusTrend" data-dir="' + (t.direction === "alta" ? "up" : "down") + '" title="' +
          (t.direction === "alta" ? "Alta" : "Queda") + " há " + t.weeks + " semana" + (t.weeks > 1 ? "s" : "") + '">' +
          (t.direction === "alta" ? "▲" : "▼") + t.weeks + "</span>";
    const observed = focus.indicators.flatMap((i) => i.years.map((y) => y.observed)).sort().at(-1);
    document.querySelector("#focusDate").textContent = observed ? "Medianas de " + day(observed) : "";
    el.innerHTML =
      "<table><thead><tr><th>Indicador</th>" +
      years.map((y) => '<th class="num">' + y + "</th>").join("") +
      '<th class="num">Há 4 sem. (' + esc(years[0] || "") + ")</th></tr></thead><tbody>" +
      focus.indicators
        .map((ind) => {
          const by = Object.fromEntries(ind.years.map((y) => [y.year, y]));
          const first = by[years[0]];
          return (
            "<tr><th scope=\"row\">" + esc(ind.name) + '<small>' + esc(ind.unit) + "</small></th>" +
            years
              .map((y) =>
                by[y]
                  ? '<td class="num"><b>' + esc(human(by[y].median, ind.unit, ind.decimals)) + "</b> " + trend(by[y].trend) + "</td>"
                  : '<td class="num muted">—</td>',
              )
              .join("") +
            '<td class="num muted">' + (first?.four_weeks_ago ? esc(human(first.four_weeks_ago.median, ind.unit, ind.decimals)) : "—") + "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  function renderCurve(detail) {
    const el = document.querySelector("#usCurve");
    if (!el) return;
    if (!detail?.curve) {
      el.innerHTML = '<p class="empty">Curva indisponível no momento.</p>';
      return;
    }
    document.querySelector("#curveDate").textContent = "Fechamento de " + day(detail.observed);
    const series = [["Hoje", detail.curve, "now"]].concat(
      detail.comparisons.filter((c) => ["1 mês", "1 ano"].includes(c.label)).map((c) => [c.label + " atrás · " + day(c.observed), c.curve, c.label === "1 mês" ? "month" : "year"]),
    );
    const all = series.flatMap(([, pts]) => pts.map((p) => Number(p.value)));
    const low = Math.floor(Math.min(...all) * 4) / 4 - 0.25, high = Math.ceil(Math.max(...all) * 4) / 4 + 0.25;
    const W = 560, H = 210, L = 38, R = 12, T = 12, B = 30;
    // Eixo x por raiz do prazo: aproxima vértices curtos sem esconder os longos.
    const x = (years) => L + ((W - L - R) * Math.sqrt(Number(years))) / Math.sqrt(30);
    const y = (v) => T + ((H - T - B) * (high - v)) / (high - low);
    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "curveChart", role: "img", "aria-label": "Curva de juros do Tesouro dos EUA hoje, há 1 mês e há 1 ano" });
    const step = high - low > 3 ? 1 : 0.5;
    for (let v = Math.ceil(low / step) * step; v <= high; v += step) {
      chart.append(svg("path", { d: `M${L} ${y(v)}H${W - R}`, class: "gridline" }));
      const t = svg("text", { x: L - 6, y: y(v) + 3, "text-anchor": "end", class: "plotTick" });
      t.textContent = nf(v, step < 1 ? 1 : 0) + "%";
      chart.append(t);
    }
    for (const p of detail.curve.filter((p) => ["3M", "1A", "2A", "5A", "10A", "30A"].includes(p.code))) {
      const t = svg("text", { x: x(p.years), y: H - 10, "text-anchor": "middle", class: "plotTick" });
      t.textContent = p.code;
      chart.append(t);
    }
    for (const [, pts, cls] of series.slice().reverse()) {
      chart.append(svg("path", { d: "M" + pts.map((p) => x(p.years).toFixed(1) + "," + y(Number(p.value)).toFixed(1)).join("L"), class: "curveLine " + cls }));
      if (cls === "now") for (const p of pts) chart.append(svg("circle", { cx: x(p.years), cy: y(Number(p.value)), r: 2.4, class: "curveDot" }));
    }
    const key = (code) => detail.curve.find((p) => p.code === code)?.value;
    const spread = (name) => {
      const v = detail.spreads?.[name];
      return v == null ? "—" : (Number(v) > 0 ? "+" : "") + nf(v, 2) + " p.p.";
    };
    el.replaceChildren();
    const facts = document.createElement("div");
    facts.className = "curveFacts";
    facts.innerHTML =
      [["3 meses", key("3M")], ["2 anos", key("2A")], ["10 anos", key("10A")], ["30 anos", key("30A")]]
        .map(([k, v]) => "<div><span>" + k + "</span><b>" + (v ? nf(v, 2) + "%" : "—") + "</b></div>")
        .join("") +
      '<div><span>10A − 2A</span><b data-inverted="' + !!detail.inverted?.["10A-2A"] + '">' + spread("10A-2A") + "</b></div>" +
      '<div><span>10A − 3M</span><b data-inverted="' + !!detail.inverted?.["10A-3M"] + '">' + spread("10A-3M") + "</b></div>";
    const legend = document.createElement("div");
    legend.className = "curveLegend";
    legend.innerHTML = series.map(([label, , cls]) => '<span><i class="' + cls + '"></i>' + esc(label) + "</span>").join("");
    const note = document.createElement("p");
    note.className = "sourceNote";
    note.innerHTML = "Taxas par diárias, " + credit(detail) + ". Domínio público. Inclinação calculada pelo Observatório; valor negativo indica curva invertida.";
    el.append(facts, chart, legend, note);
  }

  async function renderCycle() {
    const el = document.querySelector("#cliList");
    if (!el) return;
    try {
      const cli = await json("/api/macro/regional?id=ocde_cli");
      const order = ["G20", "USA", "CHN", "DEU", "JPN", "GBR", "IND", "FRA", "ITA", "BRA", "MEX", "KOR", "CAN", "AUS", "ESP", "TUR", "IDN", "ZAF"];
      const names = { G20: "G20", USA: "Estados Unidos", CHN: "China", DEU: "Alemanha", JPN: "Japão", GBR: "Reino Unido", IND: "Índia", FRA: "França", ITA: "Itália", BRA: "Brasil", MEX: "México", KOR: "Coreia do Sul", CAN: "Canadá", AUS: "Austrália", ESP: "Espanha", TUR: "Turquia", IDN: "Indonésia", ZAF: "África do Sul" };
      const rows = order.filter((k) => cli.areas[k]).map((k) => [k, cli.areas[k]]);
      const last = rows.map(([, a]) => a.observed).sort().at(-1);
      document.querySelector("#cliDate").textContent = last ? "Referência " + month(last) : "";
      el.innerHTML =
        '<ul class="cliRows">' +
        rows
          .map(([k, a]) => {
            const v = Number(a.value);
            const dir = a.previous ? Math.sign(Number(a.previous.delta)) : 0;
            const phase = v >= 100 ? (dir >= 0 ? "Expansão" : "Desaceleração") : dir >= 0 ? "Recuperação" : "Contração";
            const offset = Math.max(-3, Math.min(3, v - 100));
            return (
              '<li><span class="cliName">' + round(k, "") + esc(names[k] || k) + '</span><span class="cliBar" aria-hidden="true"><i data-side="' + (offset >= 0 ? "up" : "down") + '" data-w="' + Math.round(Math.abs(offset) * 33) + '"></i></span><b>' + nf(v, 1) + "</b><small data-phase=\"" + phase + '">' + phase + "</small></li>"
            );
          })
          .join("") +
        "</ul>";
      for (const bar of el.querySelectorAll(".cliBar i")) bar.style.width = Math.min(100, Number(bar.dataset.w)) / 2 + "%";
      const note = document.createElement("p");
      note.className = "sourceNote";
      note.innerHTML = "Índice 100 = tendência de longo prazo. Fase pela posição frente a 100 e pela direção no último mês, leitura do Observatório. " + credit(cli) + ", uso com citação da OCDE.";
      el.append(note);
    } catch {
      el.innerHTML = '<p class="empty">Indicador antecedente indisponível no momento.</p>';
    }
  }

  // Bloco macro da ficha do país.
  async function country(iso, el) {
    if (!el) return;
    el.innerHTML = '<p class="macroLoading">Carregando indicadores…</p>';
    let data = countryCache.get(iso);
    try {
      if (!data) {
        data = await json("/api/macro/pais?iso=" + encodeURIComponent(iso));
        countryCache.set(iso, data);
      }
    } catch {
      el.innerHTML = "";
      return;
    }
    if (!el.isConnected) return;
    const recent = (data.recent || []).map(
      (r) =>
        '<div class="macroRow' + (r.stale ? " stale" : "") + '"><span>' + esc(r.name) +
        "<small>" + esc(r.period) + " · " + esc(r.source) + (r.status ? " · " + esc(r.status) : "") + (r.stale ? " · defasado" : "") +
        "</small></span><b>" + esc(human(r.value, r.unit, r.decimals)) + "</b></div>",
    );
    const KEY = ["pib_crescimento", "inflacao", "pib_per_capita"];
    const recentConcepts = new Set((data.recent || []).map((r) => r.concept));
    const annualRows = (data.indicators || []).filter((r) => r.value != null);
    // Com dado recente do mesmo conceito, o anual de inflação vai para a parte recolhida.
    const keyIds = KEY.filter((k) => !(k === "inflacao" && recentConcepts.has("inflacao")));
    const row = (r) =>
          '<div class="macroRow"><span>' + esc(r.name) + "<small>" + esc(r.year) +
          (r.world && iso !== "WLD" ? " · Mundo " + esc(human(r.world.value, r.unit, r.decimals)) : "") +
          "</small></span><b>" + esc(human(r.value, r.unit, r.decimals)) + "</b></div>";
    const visible = annualRows.filter((r) => keyIds.includes(r.id)).map(row);
    const hidden = annualRows.filter((r) => !keyIds.includes(r.id)).map(row);
    if (!recent.length && !annualRows.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      '<h3 class="macroHead">Indicadores macro</h3>' +
      (recent.length ? '<h4 class="macroSub">Mais recentes</h4>' + recent.join("") : "") +
      (annualRows.length ? '<h4 class="macroSub">Anuais · Banco Mundial</h4>' + visible.join("") : "") +
      (hidden.length
        ? '<details class="macroMore"><summary>Mais indicadores anuais (' + hidden.length + ")</summary>" + hidden.join("") + "</details>"
        : "") +
      '<p class="sourceNote">' + (recent.length ? "Eurostat e OCDE com citação; " : "") + credit(data) + ", CC BY 4.0.</p>";
  }

  // Camada do mapa: quintis do indicador escolhido entre os territórios com valor.
  async function paint(id) {
    let data = indicatorCache.get(id);
    if (!data) {
      data = await json("/api/macro/indicador?id=" + encodeURIComponent(id));
      indicatorCache.set(id, data);
    }
    const entries = Object.entries(data.values).filter(([k]) => !["WLD", "EMU", "EUU"].includes(k));
    const sorted = entries.map(([, v]) => Number(v.value)).sort((a, b) => a - b);
    const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
    const klass = (v) => cuts.filter((c) => v >= c).length;
    const classes = new Map(), labels = new Map();
    for (const [iso, v] of entries) {
      classes.set(iso, String(klass(Number(v.value))));
      labels.set(iso, human(v.value, data.unit, data.decimals) + " · " + v.year);
    }
    const edges = [sorted[0], ...cuts, sorted.at(-1)];
    const legend = edges.slice(0, 5).map((lo, i) => [String(i), human(lo, data.unit, data.decimals) + " a " + human(edges[i + 1], data.unit, data.decimals)]);
    const world = data.values.WLD;
    return {
      classes,
      labels,
      legend,
      scope:
        data.name + " · " + entries.length + " territórios · Banco Mundial" +
        (world ? " · Mundo " + human(world.value, data.unit, data.decimals) + " (" + world.year + ")" : ""),
    };
  }

  return {
    async load() {
      try {
        overview = await json("/api/macro");
      } catch {
        overview = null;
      }
      renderBrazil();
      const select = document.querySelector("#macroIndicator");
      if (select && overview && !select.options.length) {
        for (const ind of overview.indicators) select.append(new Option(ind.name, ind.id));
        select.onchange = () => onIndicator(select.value);
      }
      json("/api/macro/curva").then(renderCurve, () => renderCurve(null));
      renderCycle();
      return overview;
    },
    country,
    paint,
  };
}
