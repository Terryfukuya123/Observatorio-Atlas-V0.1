// Narrador do mercado: resumo e linha do tempo em frases curtas, lidos em voz alta pelo
// próprio navegador (Web Speech API, voz em português instalada no sistema; nada sai da máquina).
// As frases vêm prontas de /api/narrador, geradas por regras fixas a partir dos dados da plataforma.
import { cachedFetch } from "./data.js";
import { esc, failure } from "./format.js";

const DAY = 86_400_000;
const KINDS = { cambio: "Câmbio", juros: "Juros", inflacao: "Inflação", atividade: "Atividade", expectativas: "Focus", fluxo: "Fluxo", noticia: "Notícia" };
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

// Voz em português do Brasil, se o sistema tiver uma (as "naturais" soam melhor).
export function pickVoice(voices) {
  const pt = voices.filter((v) => /^pt[-_]BR/i.test(v.lang));
  return pt.find((v) => /natural|online|neural/i.test(v.name)) || pt[0] || voices.find((v) => /^pt/i.test(v.lang)) || null;
}

// Novidades: eventos que não estavam na leitura anterior e merecem voz (relevantes ou destaque).
export function fresh(events, known) {
  return events.filter((e) => !known.has(e.id) && e.weight >= 2);
}

export function narrator({ root, read, save }) {
  const lead = root.querySelector(".nrLead");
  const list = root.querySelector(".nrList");
  const stamp = root.querySelector(".nrStamp");
  const play = root.querySelector("[data-play]");
  const auto = root.querySelector("[data-auto]");
  const note = root.querySelector(".nrVoiceNote");
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let data = null;
  let known = null;
  let speaking = false;
  let voice = null;
  let span = read("narratorWindow", "7") === "1" ? "1" : "7";
  let autoOn = read("narratorAuto", "") === "true";

  function loadVoice() {
    if (!synth) return;
    voice = pickVoice(synth.getVoices());
    if (data) draw(); // os botões de ouvir de cada frase dependem da voz
    drawVoice();
  }

  function drawVoice() {
    const ok = !!synth && !!voice;
    play.disabled = !ok || !data;
    auto.disabled = !ok;
    play.textContent = speaking ? "Parar" : "Ouvir resumo";
    play.setAttribute("aria-pressed", String(speaking));
    auto.setAttribute("aria-pressed", String(autoOn && ok));
    note.textContent = !synth
      ? "Este navegador não lê texto em voz alta."
      : !voice
        ? "Nenhuma voz em português instalada no sistema; o texto continua disponível."
        : "Voz: " + voice.name + ". A leitura é feita pelo próprio navegador.";
  }

  function mark(id) {
    for (const el of root.querySelectorAll("[data-speaking]")) el.removeAttribute("data-speaking");
    if (id) root.querySelector('[data-id="' + CSS.escape(id) + '"]')?.setAttribute("data-speaking", "true");
  }

  // Fila de falas: cada frase é uma fala separada, para destacar o item que está sendo lido.
  function speak(parts) {
    if (!synth || !voice || !parts.length) return;
    synth.cancel();
    speaking = true;
    drawVoice();
    parts.forEach(([text, id], i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 1.05;
      u.onstart = () => mark(id);
      if (i === parts.length - 1) u.onend = u.onerror = stop;
      synth.speak(u);
    });
  }

  function stop() {
    synth?.cancel();
    speaking = false;
    mark(null);
    drawVoice();
  }

  function opening() {
    const now = new Date();
    return "Resumo do Observatório, " + now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }) + ", " + clock.format(now).replace(":", "h") + ".";
  }

  function draw() {
    const now = Date.now();
    const s = data.summary;
    const byId = new Map(data.events.map((e) => [e.id, e]));
    lead.innerHTML = s.ids.length
      ? "<ol>" + s.ids.map((id) => byId.get(id)).filter(Boolean).map((e) => '<li data-id="' + esc(e.id) + '" data-tone="' + e.tone + '">' + esc(e.text) + "</li>").join("") + "</ol>"
      : '<p class="empty">' + esc(s.text) + "</p>";
    for (const b of root.querySelectorAll("[data-window]")) b.setAttribute("aria-pressed", String(b.dataset.window === span));
    const shown = data.events.filter((e) => e.kind === "expectativas" && e.id.startsWith("copom-next") || now - Date.parse(e.time) <= Number(span) * DAY);
    stamp.textContent = "Atualizado às " + clock.format(new Date(data.generated)) + " · " + shown.length + " frases";
    if (!shown.length) {
      list.innerHTML = '<p class="empty">Nada ' + (span === "1" ? "nas últimas 24 horas" : "nos últimos 7 dias") + ".</p>";
      return;
    }
    let html = "";
    let day = null;
    for (const e of shown) {
      const label = dayFmt.format(new Date(e.time));
      if (label !== day) {
        html += (day ? "</ol>" : "") + '<h3 class="nwDay">' + esc(label) + '</h3><ol class="nrItems">';
        day = label;
      }
      html +=
        '<li class="nrItem" data-id="' + esc(e.id) + '" data-tone="' + e.tone + '" data-weight="' + e.weight + '">' +
        '<span class="nrWhen"><time datetime="' + esc(e.time) + '">' + clock.format(new Date(e.time)) + "</time><em>" + esc(KINDS[e.kind] || e.kind) + "</em></span>" +
        '<span class="nrText">' + esc(e.text) + '<small>' + esc(e.source) + ' · <a href="' + esc(e.link) + '">ver análise</a></small></span>' +
        (voice ? '<button type="button" class="nrSay" data-say="' + esc(e.id) + '" aria-label="Ouvir esta frase">▶</button>' : "") +
        "</li>";
    }
    list.innerHTML = html + "</ol>";
  }

  function refresh() {
    cachedFetch("/api/narrador")
      .then((r) => r.json())
      .then((next) => {
        const news = known ? fresh(next.events, known) : [];
        known = new Set(next.events.map((e) => e.id));
        data = next;
        draw();
        drawVoice();
        // Narração automática: só o que chegou enquanto a página estava aberta, sem interromper outra leitura.
        if (autoOn && news.length && !speaking) speak([["Novidade no Observatório.", null], ...news.slice(0, 3).map((e) => [e.say, e.id])]);
      })
      .catch(() => {
        if (!data) {
          lead.innerHTML = failure("o narrador", "Nova tentativa em 1 minuto.");
          list.innerHTML = "";
        }
      });
  }

  root.addEventListener("click", (event) => {
    const t = event.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-play")) {
      if (speaking) return stop();
      const byId = new Map(data.events.map((e) => [e.id, e]));
      speak([[opening(), null], ...data.summary.ids.map((id) => byId.get(id)).filter(Boolean).map((e) => [e.say, e.id])]);
    } else if (t.hasAttribute("data-auto")) {
      autoOn = !autoOn;
      save("narratorAuto", String(autoOn));
      drawVoice();
    } else if (t.dataset.window) {
      span = t.dataset.window;
      save("narratorWindow", span);
      draw();
    } else if (t.dataset.say) {
      const e = data.events.find((x) => x.id === t.dataset.say);
      if (e) speak([[e.say, e.id]]);
    }
  });

  if (synth) {
    loadVoice();
    synth.addEventListener?.("voiceschanged", loadVoice);
  }
  drawVoice();
  refresh();
  setInterval(refresh, 60_000);
}
