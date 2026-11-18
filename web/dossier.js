// Ficha completa do país: tudo o que a plataforma sabe de uma economia numa só página —
// moeda e força, fase do ciclo, inflação, juros, emprego, PIB, bolsa agora, agenda e
// notícia oficial. Abre como janela sobre o espaço atual e tem endereço próprio
// (#ficha/BRA), para ser compartilhada.
import { flag, coin, round, CURRENCY_COUNTRY } from "./symbols.js";
import { MARKETS, session } from "./indices.js";
import { usdValues, strength } from "./fx-board.js";
import { phase, track, streak, NAMES } from "./cycle-clock.js";
import { EVENTS } from "./agenda.js";
import { items as NEWS } from "./bulletin.js";
import { euro } from "./map.js";
import { cachedFetch } from "./data.js";

const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + nf(d).format(Math.abs(v));
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ordinal = (n) => n + "ª";
const fmtDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const PHASE_HINT = {
  Expansão: "acima da tendência e acelerando",
  Desaceleração: "acima da tendência, mas perdendo força",
  Contração: "abaixo da tendência e perdendo força",
  Recuperação: "abaixo da tendência, mas ganhando força",
};

async function json(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw Error("Falha de leitura");
  return r.json();
}

// Linha simples num SVG de 300×90, com linha de referência opcional (ex.: 100 do CLI).
function line(values, ref = null, cls = "") {
  const v = values.map(Number).filter(Number.isFinite);
  if (v.length < 2) return "";
  const all = ref == null ? v : [...v, ref];
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const y = (x) => (84 - ((x - min) / span) * 76).toFixed(1);
  const d = v.map((x, i) => (i ? "L" : "M") + ((i / (v.length - 1)) * 300).toFixed(1) + " " + y(x)).join("");
  return (
    '<svg class="dsLine ' + cls + '" viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true">' +
    (ref == null ? "" : '<path class="ref" d="M0 ' + y(ref) + 'H300"/>') +
    '<path d="' + d + '"/></svg>'
  );
}

function kpi(label, value, sub = "", t = "flat", icon = "") {
  return (
    '<div class="dsKpi"><span>' + icon + esc(label) + "</span><b>" + esc(value) + "</b>" +
    (sub ? '<small data-tone="' + t + '">' + esc(sub) + "</small>" : "") + "</div>"
  );
}

export function dossier({ info, read, save, onMap, onCompare, onCycle }) {
  const dialog = document.createElement("dialog");
  dialog.id = "dossier";
  dialog.className = "dossier";
  dialog.setAttribute("aria-labelledby", "dsTitle");
  document.body.append(dialog);
  const cache = {};
  let iso = null;
  let back = "";

  const once = (key, url) => (cache[key] ||= json(url).catch(() => null));

  async function load(code) {
    const [atlas, cli, macro, curve, country] = await Promise.all([
      once("atlas", "/api/atlas?base=USD"),
      once("cli", "/api/macro/regional?id=ocde_cli"),
      once("macro", "/api/macro"),
      code === "USA" ? once("curve", "/api/macro/curva") : null,
      json("/api/macro/pais?iso=" + encodeURIComponent(code)).catch(() => null),
    ]);
    return { atlas, cli, macro, curve, country };
  }

  function currencyOf(code, m) {
    if (euro.has(code) || code === "EMU") return "EUR";
    return m.currency || Object.keys(CURRENCY_COUNTRY).find((c) => CURRENCY_COUNTRY[c] === code) || null;
  }

  function render(code, data) {
    const m = info(code);
    // O mapa pode ainda não ter carregado os nomes quando a ficha abre por link direto.
    const name = (m.name && m.name !== code ? m.name : NAMES[code] || { EMU: "Zona do euro" }[code]) || code;
    const cur = currencyOf(code, m);
    const recent = Object.fromEntries((data.country?.recent || []).map((r) => [r.concept, r]));
    // Anuais com mais de dez anos ficam de fora: dado velho confunde mais que ajuda.
    const recentYear = new Date().getFullYear() - 10;
    const wb = Object.fromEntries((data.country?.indicators || []).filter((i) => i.value != null && Number(i.year) >= recentYear).map((i) => [i.id, i]));
    const bra = code === "BRA" ? Object.fromEntries([...(data.macro?.brasil || []), ...(data.macro?.ibge || [])].map((s) => [s.id, s])) : {};
    const kpis = [];
    const cards = [];
    const reading = [];

    // Moeda: valor contra o dólar, variação e força entre as 10 moedas do BCE.
    let fxCard = "";
    if (data.atlas?.series && cur) {
      const { dates, values } = usdValues(data.atlas.series);
      const last = dates.length - 1;
      if (values[cur] && last > 21) {
        const rank = strength(values, last - 21, last);
        const pos = rank.findIndex((r) => r.code === cur) + 1;
        const month = rank.find((r) => r.code === cur).value;
        if (cur === "USD") {
          kpis.push(kpi("Dólar no mês", signed(month, 2) + "%", ordinal(pos) + " moeda mais forte de " + rank.length, tone(month), coin("USD")));
        } else {
          const s = data.atlas.series[cur];
          const day = (values[cur][last] / values[cur][last - 1] - 1) * 100;
          kpis.push(kpi(s.instrument, nf(cur === "JPY" || cur === "INR" ? 2 : 4).format(Number(s.value)), signed(day, 2) + "% no dia contra o dólar", tone(day), coin(cur)));
          const series = values[cur].slice(-90).map((v) => 1 / v);
          fxCard =
            '<section class="dsCard"><h3>' + coin(cur) + " Moeda · " + esc(s.instrument) + "</h3>" +
            line(series) +
            '<p class="dsNote">Últimos ' + Math.min(90, dates.length) + " dias úteis. Linha subindo = dólar mais caro.</p>" +
            '<p class="dsBig"><b data-tone="' + tone(month) + '">' + signed(month, 2) + "%</b> força no mês contra as outras moedas · " + ordinal(pos) + " de " + rank.length + "</p></section>";
        }
        reading.push("a moeda " + (month >= 0 ? "ganhou" : "perdeu") + " " + nf(1).format(Math.abs(month)) + "% de força no mês");
      }
    }

    // Ciclo econômico: indicador antecedente da OCDE.
    const area = data.cli?.areas?.[code];
    if (area?.history?.length > 2) {
      const pts = track(area.history);
      const now = pts.at(-1);
      const p = phase(now.level, now.change);
      const n = streak(pts);
      kpis.push(kpi("Ciclo · OCDE", p, "há " + n + (n === 1 ? " mês" : " meses") + " · CLI " + nf(1).format(now.level), p === "Expansão" || p === "Recuperação" ? "pos" : "neg"));
      cards.push(
        '<section class="dsCard"><h3>Ciclo econômico · ' + esc(p) + "</h3>" +
        line(area.history.slice(-24).map(([, v]) => v), 100, "cycle") +
        '<p class="dsNote">Indicador antecedente da OCDE nos últimos 24 meses. A linha tracejada é a tendência de longo prazo (100).</p>' +
        '<p class="dsBig">' + esc(name) + " está " + esc(PHASE_HINT[p]) + ' · <button type="button" class="dsLink" data-ds-cycle>Ver no relógio do ciclo →</button></p></section>',
      );
      reading.unshift(name + " está em " + p.toLowerCase());
    }

    // Inflação, juros, emprego e PIB: o dado mais recente disponível.
    const infl = bra.ipca_12m
      ? [Number(bra.ipca_12m.value), "IPCA 12 meses · " + bra.ipca_12m.observed.slice(5, 7) + "/" + bra.ipca_12m.observed.slice(0, 4)]
      : recent.inflacao
        ? [Number(recent.inflacao.value), recent.inflacao.period]
        : wb.inflacao
          ? [Number(wb.inflacao.value), "média de " + wb.inflacao.year]
          : null;
    if (infl) {
      kpis.push(kpi("Inflação em 12 meses", nf(1).format(infl[0]) + "%", infl[1]));
      reading.push("inflação de " + nf(1).format(infl[0]) + "%");
    }
    if (bra.selic_meta) kpis.push(kpi("Juros · Selic", nf(2).format(Number(bra.selic_meta.value)) + "%", "meta do Copom"));
    const ten = data.curve?.curve?.find((c) => c.code === "10A");
    if (ten) kpis.push(kpi("Juros · Treasury 10A", nf(2).format(Number(ten.value)) + "%", "título de 10 anos"));
    const job = bra.desocupacao
      ? [Number(bra.desocupacao.value), bra.desocupacao.period]
      : recent.desemprego
        ? [Number(recent.desemprego.value), recent.desemprego.period]
        : wb.desemprego
          ? [Number(wb.desemprego.value), wb.desemprego.year]
          : null;
    if (job) kpis.push(kpi("Desemprego", nf(1).format(job[0]) + "%", job[1]));
    const gdp = bra.pib_trimestre_ano
      ? [Number(bra.pib_trimestre_ano.value), bra.pib_trimestre_ano.period + ", ante 1 ano"]
      : recent.pib_ano
        ? [Number(recent.pib_ano.value), recent.pib_ano.period + ", ante 1 ano"]
        : wb.pib_crescimento
          ? [Number(wb.pib_crescimento.value), "em " + wb.pib_crescimento.year]
          : null;
    if (gdp) kpis.push(kpi("PIB", signed(gdp[0]) + "%", gdp[1], tone(gdp[0])));

    // Bolsa agora.
    const exchanges = Object.values(MARKETS).filter((x) => x.country === code);
    for (const x of exchanges) {
      const s = session(x);
      const wait = s.wait >= 60 ? Math.floor(s.wait / 60) + "h" + (s.wait % 60 ? String(s.wait % 60).padStart(2, "0") : "") : s.wait + " min";
      kpis.push(
        kpi(
          "Bolsa · " + x.venue,
          s.state === "open" ? "Aberta" : s.state === "lunch" ? "Intervalo" : "Fechada",
          s.state === "open" ? "fecha em " + wait : s.state === "lunch" ? "reabre em " + wait : "abre em " + wait,
          s.state === "open" ? "pos" : "flat",
          round(code),
        ),
      );
    }

    if (fxCard) cards.unshift(fxCard);

    // Indicadores: recentes e anuais, com a comparação com o mundo.
    const rows = [];
    for (const r of Object.values(recent))
      rows.push('<tr><th>' + esc(r.name) + "</th><td>" + nf(Number(r.decimals ?? 1)).format(Number(r.value)) + '</td><td class="muted">' + esc(r.period) + "</td><td></td></tr>");
    for (const i of Object.values(wb)) {
      const v = Number(i.value);
      const w = Number(i.world?.value);
      const big = i.unit === "US$" || i.id === "populacao";
      const shown = big ? (v >= 1e12 ? nf(2).format(v / 1e12) + " tri" : v >= 1e9 ? nf(1).format(v / 1e9) + " bi" : v >= 1e6 ? nf(1).format(v / 1e6) + " mi" : nf(0).format(v)) : nf(Number(i.decimals ?? 1)).format(v);
      const versus = Number.isFinite(w) && !big && i.id !== "pib_per_capita"
        ? '<span class="dsVs">' + (v > w ? "▲ acima" : v < w ? "▼ abaixo" : "igual") + " da média mundial (" + nf(Number(i.decimals ?? 1)).format(w) + ")</span>"
        : "";
      rows.push("<tr><th>" + esc(i.name) + " <small>" + esc(i.unit === "US$" ? "US$" : i.unit) + "</small></th><td>" + shown + '</td><td class="muted">' + esc(i.year) + "</td><td>" + versus + "</td></tr>");
    }
    if (rows.length)
      cards.push('<section class="dsCard wide"><h3>Indicadores</h3><table class="dsTable"><tbody>' + rows.join("") + '</tbody></table><p class="dsNote">Mensais: OCDE e Eurostat. Anuais: Banco Mundial (CC BY 4.0), com a média mundial ao lado.</p></section>');

    // Agenda e notícia oficial.
    const group = euro.has(code) ? "EMU" : code;
    const today = new Date().toISOString().slice(0, 10);
    const events = EVENTS.filter((e) => e.country === group && e.when.slice(0, 10) >= today && e.weight > 1).slice(0, 5);
    const news = NEWS.find((n) => n.group === group);
    if (events.length || news)
      cards.push(
        '<section class="dsCard"><h3>Agenda e notícias</h3>' +
        (events.length
          ? '<ul class="dsEvents">' + events.map((e) => {
            const d = new Date(e.when);
            return "<li><time>" + esc(fmtDay.format(d).replace(".", "")) + " · " + fmtTime.format(d) + "</time><span>" + esc(e.title) + " <small>" + esc(e.ref) + "</small></span></li>";
          }).join("") + '</ul><p class="dsNote"><a href="#agenda">Agenda completa com o impacto de cada evento →</a></p>'
          : "") +
        (news ? '<p class="dsNews"><small>' + esc(news.bank) + " · " + esc(news.newsDay.split("-").reverse().join("/")) + '</small><a href="' + esc(news.article) + '" target="_blank" rel="noreferrer">' + esc(news.headline) + " ↗</a></p>" : "") +
        "</section>",
      );

    const lead = reading.length ? reading.join(", ").replace(/^./, (c) => c.toUpperCase()) + "." : "Esta economia tem poucos dados nas fontes da plataforma.";
    dialog.innerHTML =
      '<div class="dsInner">' +
      '<header class="dsHead"><span class="dsFlag">' + flag(code === "EMU" ? "EMU" : code, name) + "</span>" +
      '<div><p class="crumb">Ficha do país' + (m.region ? " · " + esc(m.region) : "") + "</p><h2 id=\"dsTitle\">" + esc(name) + "</h2>" +
      '<p class="dsMeta">' + (cur ? coin(cur) + " " + esc(cur) : "") + (m.index ? " · " + esc(m.index) : "") + "</p></div>" +
      '<div class="dsTools"><button type="button" class="dsCopy">Copiar link</button><button type="button" class="dsClose" aria-label="Fechar ficha">×</button></div></header>' +
      '<p class="dsLead">' + esc(lead) + "</p>" +
      (kpis.length ? '<div class="dsKpis">' + kpis.join("") + "</div>" : "") +
      '<div class="dsGrid">' + cards.join("") + "</div>" +
      '<footer class="dsFoot">' +
      '<button type="button" data-ds-map>Ver no mapa</button>' +
      (cur && cur !== "USD" && data.atlas?.series?.[cur] ? '<button type="button" data-ds-compare="' + esc(cur) + '">Comparar a moeda</button>' : "") +
      (area ? "<button type=\"button\" data-ds-cycle>Ver no relógio do ciclo</button>" : "") +
      "</footer></div>";
  }

  async function open(code, { push = true } = {}) {
    code = String(code || "").toUpperCase();
    if (!code) return;
    iso = code;
    if (push) {
      if (!location.hash.startsWith("#ficha/")) back = location.hash;
      history.pushState(null, "", "#ficha/" + code);
    }
    dialog.innerHTML = '<div class="dsInner"><p class="empty">Montando a ficha…</p></div>';
    if (!dialog.open) dialog.showModal();
    save("dossier", code);
    const data = await load(code);
    if (iso === code) render(code, data);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  let pending = "";
  dialog.addEventListener("close", () => {
    if (location.hash.startsWith("#ficha/")) history.replaceState(null, "", back || location.pathname);
    iso = null;
    // Link interno clicado na ficha: navega depois de fechar.
    if (pending) {
      const go = pending;
      pending = "";
      if (location.hash === go) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = go;
    }
  });
  dialog.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      event.preventDefault();
      pending = link.getAttribute("href");
      close();
      return;
    }
    if (event.target === dialog || event.target.closest(".dsClose")) {
      close();
      return;
    }
    const code = iso;
    if (event.target.closest(".dsCopy")) {
      const url = location.origin + location.pathname + "#ficha/" + code;
      const btn = event.target.closest(".dsCopy");
      navigator.clipboard?.writeText(url).then(
        () => (btn.textContent = "Link copiado"),
        () => (btn.textContent = url),
      );
      return;
    }
    if (event.target.closest("[data-ds-map]")) {
      close();
      onMap(code);
    } else if (event.target.closest("[data-ds-compare]")) {
      const cur = event.target.closest("[data-ds-compare]").dataset.dsCompare;
      close();
      onCompare(cur);
    } else if (event.target.closest("[data-ds-cycle]")) {
      close();
      onCycle(code);
    }
  });

  // Endereço próprio: #ficha/BRA abre a ficha; voltar no navegador fecha.
  function fromHash() {
    const m = location.hash.match(/^#ficha\/([A-Za-z]{3})$/);
    if (m) open(m[1], { push: false });
    else close();
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();

  // Qualquer elemento com data-dossier="ISO" abre a ficha.
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-dossier]");
    if (!el || dialog.contains(el)) return;
    event.preventDefault();
    open(el.dataset.dossier);
  });

  return { open, close };
}
