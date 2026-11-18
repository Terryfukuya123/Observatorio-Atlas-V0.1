import { localClock, instantAt, sessionDay } from "./session-calendar.js";
// Relógio dos pregões: as 24 horas do dia de quem está olhando, com a janela de negociação
// de cada bolsa, o intervalo de almoço e uma linha do "agora".
import { MARKETS, session } from "./indices.js";
import { round } from "./symbols.js";
import { esc } from "./format.js";

const DAY = 86400000;
const hhmm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Janelas de negociação [início, fim] que tocam o intervalo [from, to].
export function windows(market, from, to) {
  const out = [];
  for (let t = from - DAY; t < to + DAY; t += DAY) {
    const date = localClock(market.tz, t).date;
    const day = sessionDay(market, date);
    if (!day.trades) continue;
    const pieces = market.lunch
      ? [[day.open, market.lunch[0]], [market.lunch[1], day.close]]
      : [[day.open, day.close]];
    for (const [a, b] of pieces) {
      const start = instantAt(date, a, market.tz);
      const end = instantAt(date, b, market.tz);
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
    const to = new Date(now).setHours(24, 0, 0, 0);
    const duration = to - from;
    const pct = (t) => (((t - from) / duration) * 100).toFixed(2);
    const list = Object.values(MARKETS).map((m) => ({ m, s: session(m, now), w: windows(m, from, to) }));
    // Ordem do dia: quem abre primeiro no horário local fica em cima.
    list.sort((a, b) => (a.w[0]?.[0] ?? Infinity) - (b.w[0]?.[0] ?? Infinity));
    const open = list.filter((x) => x.s.state === "open").length;
    summary.textContent = open + " de " + list.length + " abertas · " + hhmm.format(now) + " no seu horário";
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21]
      .map((h) => '<span style-x="' + pct(new Date(now).setHours(h, 0, 0, 0)) + '">' + String(h).padStart(2, "0") + "h</span>")
      .join("");
    body.innerHTML =
      '<div class="clockScale"><span></span><div>' + ticks + '<i class="clockNow" style-x="' + pct(now) + '"></i></div></div>' +
      '<ul class="clockRows">' +
      list
        .map(({ m, s, w }) =>
          '<li data-state="' + s.state + '"><span class="clockName">' + round(m.country) + "<strong>" + esc(m.name) + "</strong><small>" +
          esc(s.holiday || (s.covered ? m.venue : m.venue + " · regular")) + '</small></span><span class="clockTrack">' +
          w.map(([a, b]) => '<b style-x="' + pct(a) + '" style-w="' + ((b - a) / duration * 100).toFixed(2) + '" title="' +
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
