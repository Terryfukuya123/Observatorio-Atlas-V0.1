// Meu painel: a lista de indicadores que o usuário fixou no Pulso do dia. Fica no
// navegador (localStorage), sem conta. Quem muda a lista avisa com o evento "oeg:panel".

export const DEFAULT_PANEL = ["dollar", "selic", "inflation", "flow", "funds", "treasury", "reserves", "sessions"];
const KEY = "oeg.panel";

// Séries que já têm um cartão próprio no Pulso: fixar a série fixa esse cartão.
export const ALIAS = { selic_meta: "selic", ipca_12m: "inflation", reservas: "reserves", "ptax:USD": "dollar" };
export const keyOf = (id) => ALIAS[id] || "s:" + id;

export function panel() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return [...DEFAULT_PANEL];
    return raw.split(",").filter(Boolean);
  } catch {
    return [...DEFAULT_PANEL];
  }
}

export function setPanel(list) {
  try {
    localStorage.setItem(KEY, [...new Set(list)].join(","));
  } catch {}
  window.dispatchEvent(new CustomEvent("oeg:panel"));
}

export const isPinned = (key) => panel().includes(key);
export const isDefault = (list = panel()) => list.join(",") === DEFAULT_PANEL.join(",");

export function togglePin(key) {
  const list = panel();
  setPanel(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
}

// Botão de fixar, usado nos cartões de outras seções.
export const pinButton = (key, name) =>
  '<button type="button" class="pin" data-pin="' + key + '" aria-pressed="' + isPinned(key) + '" title="Fixar no Meu painel" aria-label="Fixar ' +
  String(name).replace(/[&<>"']/g, "") + ' no Meu painel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/></svg></button>';

// Mantém todos os botões de fixar em sincronia e trata o clique em qualquer um deles.
document.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-pin]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  togglePin(btn.dataset.pin);
});
window.addEventListener("oeg:panel", () => {
  const list = panel();
  for (const btn of document.querySelectorAll("button[data-pin]")) btn.setAttribute("aria-pressed", String(list.includes(btn.dataset.pin)));
});
