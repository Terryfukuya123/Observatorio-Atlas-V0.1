// Ao vivo: o que acabou de sair nos canais oficiais (BC, governo, IBGE, CVM, Fed, BCE).
// Linha do tempo com tema, impacto e ponte para a análise da plataforma; faixa de
// "última hora" no topo de todos os espaços; aviso opcional do navegador para o que
// tiver alto impacto. A lista se atualiza sozinha a cada minuto.
import { cachedFetch } from "./data.js";
import { esc, failure } from "./format.js";

const URL = "/api/noticias";
const IMPACT = { 3: "Alto impacto", 2: "Médio impacto", 1: "Baixo impacto" };
const PAGE = 25;
const HOUR = 3600e3;
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

export const load = () => cachedFetch(URL).then((r) => r.json());

export function ago(iso, now = Date.now()) {
  const mins = Math.round((now - Date.parse(iso)) / 60e3);
  if (mins < 1) return "agora";
  if (mins < 60) return "há " + mins + " min";
  if (mins < 24 * 60) return "há " + Math.round(mins / 60) + " h";
  const days = Math.round(mins / 1440);
  return "há " + days + (days === 1 ? " dia" : " dias");
}

function dayLabel(date, now) {
  const key = (d) => d.toLocaleDateString("pt-BR");
  if (key(date) === key(now)) return "Hoje";
  if (key(date) === key(new Date(now.getTime() - 864e5))) return "Ontem";
  return weekday.format(date);
}

// Linha de notícia, usada aqui e no roteiro do pregão (Bolsas agora).
export function row(item, data, { fresh = false, compact = false } = {}) {
  const when = new Date(item.time);
  const source = data.sources.find((s) => s.id === item.source);
  const [href, label] = data.links[item.topic] || [];
  return (
    '<li class="nwItem" data-impact="' + item.impact + '"' + (fresh ? ' data-fresh="true"' : "") + ">" +
    '<span class="nwWhen"><time datetime="' + esc(item.time) + '">' + (item.day_only ? "—" : clock.format(when)) + "</time>" +
    (compact ? "" : "<small>" + esc(item.day_only ? "no dia" : ago(item.time)) + "</small>") +
    "</span>" +
    '<span class="nwMain">' +
    '<span class="nwMeta"><b class="nwDot" title="' + IMPACT[item.impact] + '"></b><span class="sr">' + IMPACT[item.impact] + ". </span>" +
    "<em>" + esc(source?.short || item.source) + "</em>" +
    (source?.lang === "en" ? '<span class="nwLang" title="Texto original em inglês">EN</span>' : "") +
    '<span class="nwTopic">' + esc(data.topics[item.topic] || "") + "</span>" +
    (fresh ? '<span class="nwNew">novo</span>' : "") + "</span>" +
    '<a class="nwTitle" href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer">' + esc(item.title) + "</a>" +
    (!compact && item.summary ? '<span class="nwSummary">' + esc(item.summary) + "</span>" : "") +
    (!compact && href ? '<a class="nwBridge" href="' + href + '">Na plataforma: ' + esc(label) + " →</a>" : "") +
    "</span></li>"
  );
}

export function liveNews({ root, flash, read, save }) {
  const list = root.querySelector(".nwList");
  const chips = root.querySelector(".nwTopics");
  const stamp = root.querySelector(".nwStamp");
  const status = root.querySelector(".nwStatus");
  const notify = root.querySelector("[data-notify]");
  const windows = [...root.querySelectorAll("[data-window]")];
  const onlyHigh = root.querySelector("[data-high]");
  let topic = read("newsTopic", "todos");
  let span = read("newsWindow", "24") === "168" ? "168" : "24";
  let high = read("newsHigh", "") === "true";
  let shown = PAGE;
  let data = null;
  // Novidade: o que o servidor viu pela primeira vez depois da última visita.
  const lastVisit = read("newsSeen", null);
  save("newsSeen", new Date().toISOString());
  let notifiedUntil = new Date().toISOString();

  const isFresh = (item) => !!lastVisit && (item.seen || item.time) > lastVisit;

  function draw() {
    if (!data) return;
    const now = Date.now();
    const recent = data.items.filter((i) => now - Date.parse(i.time) <= Number(span) * HOUR);
    const counts = {};
    for (const i of recent) counts[i.topic] = (counts[i.topic] || 0) + 1;
    if (topic !== "todos" && !counts[topic]) topic = "todos";
    chips.innerHTML =
      '<button type="button" data-topic="todos" aria-pressed="' + (topic === "todos") + '">Tudo <small>' + recent.length + "</small></button>" +
      Object.entries(data.topics)
        .filter(([key]) => counts[key])
        .map(([key, label]) => '<button type="button" data-topic="' + key + '" aria-pressed="' + (topic === key) + '">' + esc(label) + " <small>" + counts[key] + "</small></button>")
        .join("");
    for (const b of windows) b.setAttribute("aria-pressed", String(b.dataset.window === span));
    onlyHigh.setAttribute("aria-pressed", String(high));
    const picked = recent.filter((i) => (topic === "todos" || i.topic === topic) && (!high || i.impact === 3));
    const highs = recent.filter((i) => i.impact === 3).length;
    const ok = data.sources.filter((s) => s.received && !s.error).length;
    stamp.textContent = recent.length + " itens · " + highs + " de alto impacto";
    status.innerHTML =
      ok + " de " + data.sources.length + " fontes em dia" +
      (data.sources.some((s) => s.error) ? ' · <button type="button" data-health>ver detalhes</button>' : "") +
      (data.collecting ? " · coletando agora" : "");
    if (!picked.length) {
      list.innerHTML = '<p class="empty">Nada ' + (high ? "de alto impacto " : "") + "neste filtro " + (span === "24" ? "nas últimas 24 horas" : "nos últimos 7 dias") + ".</p>";
      return;
    }
    // Destaque: o item de maior impacto do período (o mais recente em caso de empate).
    const lead = high ? null : picked.find((i) => i.impact === 3);
    let html = lead
      ? '<div class="nwLeadItem"><h3 class="nwDay">Mais importante ' + (span === "24" ? "nas últimas 24 horas" : "nos últimos 7 dias") +
        '</h3><ol class="nwItems">' + row(lead, data, { fresh: isFresh(lead) }) + "</ol></div>"
      : "";
    let day = null;
    for (const item of picked.slice(0, shown)) {
      const label = dayLabel(new Date(item.time), new Date(now));
      if (label !== day) {
        if (day) html += "</ol>";
        html += '<h3 class="nwDay">' + esc(label) + '</h3><ol class="nwItems">';
        day = label;
      }
      html += row(item, data, { fresh: isFresh(item) });
    }
    html += "</ol>";
    if (picked.length > shown) html += '<button type="button" class="nwMore" data-more>Mostrar mais ' + Math.min(PAGE, picked.length - shown) + " de " + (picked.length - shown) + "</button>";
    list.innerHTML = html;
  }

  function drawFlash() {
    if (!flash || !data) return;
    const top = data.items.find((i) => i.impact === 3 && !i.day_only && Date.now() - Date.parse(i.time) <= 12 * HOUR);
    if (!top || read("newsDismissed", null) === top.id) {
      flash.hidden = true;
      return;
    }
    const source = data.sources.find((s) => s.id === top.source);
    flash.innerHTML =
      '<span class="flLabel"><b class="nwDot"></b>Última hora</span>' +
      '<time datetime="' + esc(top.time) + '">' + clock.format(new Date(top.time)) + " · " + esc(ago(top.time)) + "</time>" +
      '<a class="flTitle" href="#noticias">' + esc(top.title) + "</a>" +
      "<em>" + esc(source?.short || top.source) + "</em>" +
      '<button type="button" class="flClose" aria-label="Dispensar esta notícia" data-dismiss="' + esc(top.id) + '">×</button>';
    flash.hidden = false;
  }

  function alertNew() {
    if (read("newsNotify", "") !== "true" || !("Notification" in window) || Notification.permission !== "granted") return;
    const fresh = data.items.filter((i) => i.impact === 3 && (i.seen || i.time) > notifiedUntil);
    notifiedUntil = new Date().toISOString();
    for (const item of fresh.slice(0, 3)) {
      const source = data.sources.find((s) => s.id === item.source);
      const note = new Notification("Observatório · " + (data.topics[item.topic] || "Última hora"), { body: item.title + " (" + (source?.short || "") + ")", tag: item.id });
      note.onclick = () => {
        window.focus();
        location.hash = "#noticias";
      };
    }
  }

  function drawNotify() {
    if (!notify) return;
    const supported = "Notification" in window;
    const on = supported && read("newsNotify", "") === "true" && Notification.permission === "granted";
    notify.hidden = !supported;
    notify.setAttribute("aria-pressed", String(on));
    notify.textContent = on ? "Avisos de alto impacto ligados" : "Avisar alto impacto";
  }

  function refresh() {
    load()
      .then((next) => {
        data = next;
        draw();
        drawFlash();
        alertNew();
      })
      .catch(() => {
        if (!data) list.innerHTML = failure("as notícias", "Os canais oficiais podem estar fora do ar; nova tentativa em 1 minuto.");
      });
  }

  root.addEventListener("click", (event) => {
    const t = event.target.closest("button");
    if (!t) return;
    if (t.dataset.topic) {
      topic = t.dataset.topic;
      save("newsTopic", topic);
    } else if (t.dataset.window) {
      span = t.dataset.window;
      save("newsWindow", span);
    } else if (t.hasAttribute("data-high")) {
      high = !high;
      save("newsHigh", String(high));
    } else if (t.hasAttribute("data-more")) {
      shown += PAGE;
    } else if (t.hasAttribute("data-notify")) {
      const on = read("newsNotify", "") === "true" && Notification.permission === "granted";
      if (on) {
        save("newsNotify", "false");
        drawNotify();
        return;
      }
      Notification.requestPermission().then((answer) => {
        save("newsNotify", String(answer === "granted"));
        drawNotify();
      });
      return;
    } else return;
    if (!t.dataset.more) shown = PAGE;
    draw();
  });
  flash?.addEventListener("click", (event) => {
    const t = event.target.closest("[data-dismiss]");
    if (!t) return;
    save("newsDismissed", t.dataset.dismiss);
    flash.hidden = true;
  });

  drawNotify();
  refresh();
  setInterval(refresh, 60_000);
}
