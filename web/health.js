// Saúde das fontes: o botão do topo resume todas as coletas e abre o painel com cada
// série, a última observação, quando foi coletada, a próxima tentativa e o erro.
import { cachedFetch } from "./data.js";
import { esc, fullDay } from "./format.js";

const LABEL = { ok: "Em dia", warn: "Atenção", fail: "Falha" };
const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// "há 3 h", "há 2 dias", "em 40 min".
export function relative(iso, now = Date.now()) {
  if (!iso) return "—";
  const diff = (new Date(iso).getTime() - now) / 60000;
  const abs = Math.abs(diff);
  const text = abs < 1 ? "agora" : abs < 60 ? Math.round(abs) + " min" : abs < 48 * 60 ? Math.round(abs / 60) + " h" : Math.round(abs / 1440) + " dias";
  return text === "agora" ? text : (diff < 0 ? "há " : "em ") + text;
}

const observed = (v) => (!v ? "—" : /^\d{4}$/.test(v) ? v : /^\d{4}-\d{2}-01$/.test(v) ? v.slice(5, 7) + "/" + v.slice(0, 4) : fullDay(v));

export function summary(h) {
  const { warn = 0, fail = 0 } = h.counts || {};
  if (fail) return fail + (fail > 1 ? " fontes com falha" : " fonte com falha");
  if (warn) return warn + (warn > 1 ? " fontes pedem atenção" : " fonte pede atenção");
  return "Fontes em dia";
}

function table(h, onlyIssues) {
  const items = h.items.filter((i) => !onlyIssues || i.level !== "ok");
  if (!items.length) return '<p class="hsEmpty">Nenhuma fonte com atraso ou falha agora.</p>';
  const groups = new Map();
  for (const i of items) groups.set(i.provider, [...(groups.get(i.provider) || []), i]);
  return [...groups]
    .map(
      ([provider, list]) =>
        '<section class="hsGroup"><h3>' + esc(provider) + " <small>" + list.length + "</small></h3><ul>" +
        list
          .map(
            (i) =>
              '<li data-level="' + i.level + '"><b class="dot"></b><span class="hsName">' + esc(i.name) +
              (i.error || i.note ? "<small>" + esc(i.error || i.note) + "</small>" : "") +
              '</span><span class="hsStatus">' + esc(i.status || LABEL[i.level]) + "</span>" +
              '<span class="hsObs" title="Última observação">' + esc(observed(i.observed)) + "</span>" +
              '<span class="hsWhen" title="' + esc(i.received ? "Coletado em " + when.format(new Date(i.received)) : "Sem coleta registrada") + '">' + esc(relative(i.received)) + "</span></li>",
          )
          .join("") +
        "</ul></section>",
    )
    .join("");
}

export function sourceHealth({ button, text, dialog }) {
  const body = dialog.querySelector(".hsBody");
  const head = dialog.querySelector(".hsSummary");
  const filter = dialog.querySelector("#hsIssues");
  let last = null;

  function draw() {
    if (!last) return;
    text.textContent = summary(last);
    button.dataset.ok = last.overall === "ok" ? "yes" : "no";
    button.dataset.level = last.overall;
    const c = last.counts;
    head.innerHTML =
      '<span data-level="ok"><b>' + c.ok + "</b> em dia</span>" +
      '<span data-level="warn"><b>' + c.warn + "</b> pedem atenção</span>" +
      '<span data-level="fail"><b>' + c.fail + "</b> com falha</span>" +
      "<small>Verificado " + esc(relative(last.generated)) + "</small>";
    body.innerHTML = table(last, filter.checked);
  }

  async function load() {
    try {
      const r = await cachedFetch("/api/saude");
      if (!r.ok) throw Error("HTTP " + r.status);
      last = await r.json();
    } catch {
      text.textContent = "Saúde das fontes indisponível";
      button.dataset.ok = "no";
      return;
    }
    draw();
  }

  button.addEventListener("click", () => {
    draw();
    if (!dialog.open) dialog.showModal();
    load();
  });
  filter.addEventListener("change", draw);
  // Os detalhes do câmbio abrem em outra janela: fecha esta antes.
  dialog.querySelector(".hsMeta")?.addEventListener("click", () => dialog.close());
  // Qualquer aviso de falha nas seções leva a este painel.
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-health]")) button.click();
  });
  load();
  setInterval(load, 300000);
}
