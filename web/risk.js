// Termômetro de risco: um placar de apetite a risco para o Brasil, montado com regras
// fixas e públicas sobre dados que a plataforma já tem. Cada componente recebe nota de
// −2 (aversão) a +2 (apetite); a média vira um número de 0 a 100. Calcula também o mesmo
// placar de um mês atrás, para mostrar a direção. Não é recomendação de investimento.
import { usdValues, strength } from "./fx-board.js";
import { phase, track } from "./cycle-clock.js";

const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + nf(d).format(Math.abs(v));
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Nota pela posição do valor entre quatro limites crescentes: abaixo do 1º = −2 … acima do 4º = +2.
// Com invert, valores altos são ruins (ex.: dólar forte).
export function band(value, limits, invert = false) {
  let i = 0;
  while (i < limits.length && value >= limits[i]) i++;
  const score = i - 2;
  return invert ? -score : score;
}

const PHASE_SCORE = { Expansão: 2, Recuperação: 1, Desaceleração: -1, Contração: -2 };

export function zone(index) {
  if (index < 30) return "Aversão a risco";
  if (index < 45) return "Cautela";
  if (index <= 55) return "Neutro";
  if (index <= 70) return "Apetite moderado";
  return "Apetite a risco";
}

export const toIndex = (scores) => Math.round(((scores.reduce((s, x) => s + x, 0) / scores.length + 2) / 4) * 100);

// Soma de meses fechados terminando "back" meses antes do último.
function lastMonths(monthly, n, back) {
  const list = monthly.filter((m) => !m.partial);
  const end = list.length - back;
  return end - n < 0 ? null : list.slice(end - n, end).reduce((s, m) => s + Number(m.value), 0);
}

// Cada componente devolve { value, text, score } para o mês atual (0) ou o anterior (1).
export function components({ atlas, curve, flows, cli, macro }) {
  const out = [];
  const fx = atlas?.series ? usdValues(atlas.series) : null;
  const L = fx ? fx.dates.length - 1 : 0;
  const fxAt = (code, back) => {
    const to = L - 21 * back;
    const from = to - 21;
    return from < 0 ? null : strength(fx.values, from, to).find((r) => r.code === code)?.value;
  };

  // Mundo
  const spread = curve?.spread_history?.["10A-2A"]?.map(([, v]) => Number(v)) || [];
  out.push({
    id: "curve",
    group: "Mundo",
    name: "Curva de juros dos EUA",
    short: "a curva de juros dos EUA",
    href: "#recessionSignal",
    why: "Curva invertida (10 anos abaixo de 2) costuma anteceder recessão nos EUA e afasta o investidor de risco.",
    at(back) {
      const v = spread[spread.length - 1 - 21 * back];
      return v == null ? null : { value: v, text: "10A − 2A: " + signed(v, 2) + " p.p.", score: band(v, [-0.5, 0, 0.25, 0.75]) };
    },
  });
  const ten = curve?.history?.["10A"]?.map(([, v]) => Number(v)) || [];
  out.push({
    id: "treasury",
    group: "Mundo",
    name: "Juros longos dos EUA",
    short: "os juros longos dos EUA",
    href: "#juros",
    why: "Treasury subindo encarece o dinheiro no mundo e puxa recursos de emergentes como o Brasil.",
    at(back) {
      const to = ten.length - 1 - 21 * back;
      if (to - 21 < 0) return null;
      const d = ten[to] - ten[to - 21];
      return { value: d, text: "10 anos: " + signed(d, 2) + " p.p. no mês", score: band(d, [-0.3, -0.1, 0.1, 0.3], true) };
    },
  });
  out.push({
    id: "dollar",
    group: "Mundo",
    name: "Dólar no mundo",
    short: "o dólar no mundo",
    href: "#moedas",
    why: "Dólar forte contra as outras moedas aperta as condições financeiras dos emergentes.",
    at(back) {
      const v = fx && fxAt("USD", back);
      return v == null ? null : { value: v, text: "força no mês: " + signed(v, 2) + "%", score: band(v, [-2, -0.75, 0.75, 2], true) };
    },
  });
  const g20 = cli?.areas?.G20?.history;
  out.push({
    id: "world",
    group: "Mundo",
    name: "Ciclo global (G20)",
    short: "o ciclo global",
    href: "#ciclo",
    why: "Economia mundial acelerando sustenta preços de commodities e o apetite por emergentes.",
    at(back) {
      if (!g20 || g20.length < 3 + back) return null;
      const p = track(g20.slice(0, g20.length - back)).at(-1);
      const ph = phase(p.level, p.change);
      return { value: p.level, text: ph + " · CLI " + nf(1).format(p.level), score: PHASE_SCORE[ph] };
    },
  });

  // Brasil
  out.push({
    id: "real",
    group: "Brasil",
    name: "Real",
    short: "o real",
    href: "#moedas",
    why: "Real perdendo força contra as outras moedas é sinal de saída de recursos ou de desconfiança.",
    at(back) {
      const v = fx && fxAt("BRL", back);
      return v == null ? null : { value: v, text: "força no mês: " + signed(v, 2) + "%", score: band(v, [-3, -1, 1, 3]) };
    },
  });
  const flowMonths = (flows?.data?.months || []).map((m) => ({ value: m.total, partial: m.partial }));
  out.push({
    id: "flow",
    group: "Brasil",
    name: "Fluxo cambial",
    short: "o fluxo cambial",
    href: "#fluxo",
    why: "Mais dólares entrando do que saindo pelo câmbio sustenta o real e a liquidez.",
    at(back) {
      const v = lastMonths(flowMonths, 3, back);
      return v == null ? null : { value: v, text: "3 meses: " + signed(v / 1000) + " US$ bi", score: band(v, [-10000, -2000, 2000, 10000]) };
    },
  });
  const port = (flows?.data?.foreigners?.items || []).filter((i) => i.id.startsWith("carteira_"));
  const portMonths = port.length
    ? port[0].monthly.map(([m], k) => ({ value: port.reduce((s, i) => s + Number(i.monthly[k]?.[1] || 0), 0), month: m }))
    : [];
  out.push({
    id: "portfolio",
    group: "Brasil",
    name: "Estrangeiros em ações e títulos",
    short: "os estrangeiros na carteira",
    href: "#fluxo",
    why: "O investidor estrangeiro comprando bolsa e renda fixa é o termômetro mais direto do apetite por Brasil.",
    at(back) {
      const v = lastMonths(portMonths, 3, back);
      return v == null ? null : { value: v, text: "3 meses: " + signed(v / 1000) + " US$ bi", score: band(v, [-6000, -1000, 1000, 6000]) };
    },
  });
  const bra = cli?.areas?.BRA?.history;
  out.push({
    id: "cycle",
    group: "Brasil",
    name: "Ciclo do Brasil",
    short: "o ciclo do Brasil",
    href: "#ciclo",
    why: "Economia acima da tendência e acelerando sustenta lucros das empresas e arrecadação.",
    at(back) {
      if (!bra || bra.length < 3 + back) return null;
      const p = track(bra.slice(0, bra.length - back)).at(-1);
      const ph = phase(p.level, p.change);
      return { value: p.level, text: ph + " · CLI " + nf(1).format(p.level), score: PHASE_SCORE[ph] };
    },
  });
  const ipca = (macro?.brasil || []).find((s) => s.id === "ipca_12m")?.history?.map(([, v]) => Number(v)) || [];
  out.push({
    id: "inflation",
    group: "Brasil",
    name: "Inflação e meta",
    short: "a inflação",
    href: "#bussola",
    why: "Inflação acima do teto da meta (4,5%) obriga juros altos por mais tempo e pesa sobre a bolsa.",
    at(back) {
      const v = ipca[ipca.length - 1 - back];
      return v == null ? null : { value: v, text: "IPCA 12 meses: " + nf(2).format(v) + "%", score: band(v, [3.25, 4.5, 6, Infinity], true) - 1 };
    },
  });
  return out;
}

// Placar de agora e de um mês atrás.
export function scoreboard(data) {
  const list = components(data).map((c) => ({ ...c, now: c.at(0), before: c.at(1) }));
  const now = list.filter((c) => c.now).map((c) => c.now.score);
  const both = list.filter((c) => c.now && c.before);
  return {
    list,
    index: now.length ? toIndex(now) : null,
    before: both.length ? toIndex(both.map((c) => c.before.score)) : null,
    sameBase: both.length ? toIndex(both.map((c) => c.now.score)) : null,
  };
}

// Medidor semicircular: arco por zonas e ponteiro.
function gauge(index) {
  const cx = 150;
  const cy = 140;
  const r = 110;
  const point = (v, rad = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
  };
  const arc = (from, to, cls) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return '<path class="' + cls + '" d="M' + x1.toFixed(1) + " " + y1.toFixed(1) + "A" + r + " " + r + " 0 0 1 " + x2.toFixed(1) + " " + y2.toFixed(1) + '"/>';
  };
  const [nx, ny] = point(index, r - 18);
  return (
    '<svg class="rkGauge" viewBox="0 0 300 160" role="img" aria-label="Termômetro em ' + index + ' de 100: ' + zone(index) + '">' +
    arc(0, 29.5, "z1") + arc(30.5, 44.5, "z2") + arc(45.5, 55, "z3") + arc(56, 70, "z4") + arc(71, 100, "z5") +
    '<line class="needle" x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '"/>' +
    '<circle class="hub" cx="' + cx + '" cy="' + cy + '" r="6"/>' +
    '<text x="22" y="158">Aversão</text><text x="278" y="158" text-anchor="end">Apetite</text>' +
    "</svg>"
  );
}

function dots(score) {
  return (
    '<span class="rkDots" aria-label="Nota ' + score + ' de −2 a +2">' +
    [-2, -1, 0, 1, 2].map((s) => '<i data-s="' + s + '"' + (s === score ? ' class="on"' : "") + "></i>").join("") +
    "</span>"
  );
}

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

export function riskMeter({ root }) {
  const body = root.querySelector(".rkBody");

  function draw(data) {
    const b = scoreboard(data);
    if (b.index == null) {
      body.innerHTML = '<p class="empty">Dados insuficientes para o termômetro agora.</p>';
      return;
    }
    const diff = b.before == null ? null : b.sameBase - b.before;
    const best = b.list.filter((c) => c.now).sort((x, y) => y.now.score - x.now.score);
    const up = best.filter((c) => c.now.score > 0).slice(0, 2).map((c) => c.short);
    const down = best.filter((c) => c.now.score < 0).reverse().slice(0, 2).map((c) => c.short);
    const reading =
      (up.length ? "A favor: " + up.join(" e ") + ". " : "") + (down.length ? "Pesam contra: " + down.join(" e ") + "." : "");
    const groups = ["Mundo", "Brasil"]
      .map(
        (g) =>
          '<div class="rkGroup"><h3>' + g + "</h3>" +
          b.list
            .filter((c) => c.group === g)
            .map((c) =>
              c.now
                ? '<a class="rkRow" href="' + c.href + '" data-score="' + c.now.score + '"><span class="rkName"><b>' + esc(c.name) + "</b><small>" + esc(c.now.text) + "</small></span>" +
                  dots(c.now.score) +
                  (c.before && c.before.score !== c.now.score ? '<span class="rkMove" data-dir="' + (c.now.score > c.before.score ? "up" : "down") + '" title="Há um mês: ' + c.before.score + '">' + (c.now.score > c.before.score ? "▲" : "▼") + "</span>" : '<span class="rkMove"></span>') +
                  '<span class="rkWhy">' + esc(c.why) + "</span></a>"
                : "",
            )
            .join("") +
          "</div>",
      )
      .join("");
    body.innerHTML =
      '<div class="rkMain">' + gauge(b.index) +
      '<p class="rkValue"><b>' + b.index + '</b><span>de 100</span></p><p class="rkZone" data-zone="' + esc(zone(b.index)) + '">' + esc(zone(b.index)) + "</p>" +
      (diff == null ? "" : '<p class="rkDiff">' + (diff === 0 ? "Igual a um mês atrás" : (diff > 0 ? "▲ " : "▼ ") + Math.abs(diff) + " pontos em um mês, para " + (diff > 0 ? "mais apetite" : "mais aversão")) + "</p>") +
      '<p class="rkRead">' + esc(reading) + "</p></div>" +
      '<div class="rkParts">' + groups + "</div>";
  }

  Promise.all(
    ["/api/atlas?base=USD", "/api/macro/curva", "/api/fluxo", "/api/macro/regional?id=ocde_cli", "/api/macro"].map((u) => json(u).catch(() => null)),
  ).then(([atlas, curve, flows, cli, macro]) => draw({ atlas, curve, flows, cli, macro }));
}
