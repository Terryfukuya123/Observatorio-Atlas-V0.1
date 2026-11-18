// Relógio dos pregões: as 24 horas do dia de quem está olhando, com a janela de negociação
// de cada bolsa, o intervalo de almoço e uma linha do "agora". Feriados não entram.
import { MARKETS, session } from "./indices.js";
import { round } from "./symbols.js";

const DAY = 86400000;
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hhmm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Diferença (ms) entre o relógio de parede do fuso e UTC num instante.
function offset(tz, instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
}

// Instante (ms) de um horário de parede "HH:MM" numa data (ano, mês, dia) do fuso.
function zoned(y, m, d, time, tz) {
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m, d, h, mi);
  const first = guess - offset(tz, guess);
  return guess - offset(tz, first);
}

// Janelas de negociação [início, fim] que tocam o intervalo [from, to].
export function windows(market, from, to) {
  const out = [];
  for (let t = from - DAY; t < to + DAY; t += DAY) {
    const local = new Date(t + offset(market.tz, t));
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();
    const wd = local.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const pieces = market.lunch
      ? [[market.open, market.lunch[0]], [market.lunch[1], market.close]]
      : [[market.open, market.close]];
    for (const [a, b] of pieces) {
      const start = zoned(y, m, d, a, market.tz);
      const end = zoned(y, m, d, b, market.tz);
      if (end > from && start < to && !out.some(([s]) => s === start)) out.push([Math.max(start, from), Math.min(end, to)]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function sessionClock({ root }) {
  const body = root.querySelector(".clockBody");
  const summary = root.querySelector(".clockSummary");

  function draw() {
    const now = new Date();
    const from = new Date(now).setHours(0, 0, 0, 0);
    const to = from + DAY;
    const pct = (t) => (((t - from) / DAY) * 100).toFixed(2);
    const list = Object.values(MARKETS).map((m) => ({ m, s: session(m, now), w: windows(m, from, to) }));
    // Ordem do dia: quem abre primeiro no horário local fica em cima.
    list.sort((a, b) => (a.w[0]?.[0] ?? Infinity) - (b.w[0]?.[0] ?? Infinity));
    const open = list.filter((x) => x.s.state === "open").length;
    summary.textContent = open + " de " + list.length + " abertas · " + hhmm.format(now) + " no seu horário";
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21]
      .map((h) => '<span style-x="' + ((h / 24) * 100).toFixed(2) + '">' + String(h).padStart(2, "0") + "h</span>")
      .join("");
    body.innerHTML =
      '<div class="clockScale"><span></span><div>' + ticks + '<i class="clockNow" style-x="' + pct(now) + '"></i></div></div>' +
      '<ul class="clockRows">' +
      list
        .map(({ m, s, w }) =>
          '<li data-state="' + s.state + '"><span class="clockName">' + round(m.country) + "<strong>" + esc(m.name) + "</strong><small>" +
          esc(m.venue) + '</small></span><span class="clockTrack">' +
          w.map(([a, b]) => '<b style-x="' + pct(a) + '" style-w="' + ((b - a) / DAY * 100).toFixed(2) + '" title="' +
            esc(hhmm.format(a) + "–" + hhmm.format(b)) + '"></b>').join("") +
          '<i class="clockNow" style-x="' + pct(now) + '"></i></span></li>')
        .join("") +
      "</ul>";
    for (const el of body.querySelectorAll("[style-x]")) {
      el.style.left = el.getAttribute("style-x") + "%";
      el.removeAttribute("style-x");
    }
    for (const el of body.querySelectorAll("[style-w]")) {
      el.style.width = el.getAttribute("style-w") + "%";
      el.removeAttribute("style-w");
    }
  }

  draw();
  setInterval(draw, 60000);
}
