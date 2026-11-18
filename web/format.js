// Formatação comum a todas as seções: texto seguro para HTML, números em pt-BR,
// sinais, tons (alta/baixa) e datas curtas. Uma cópia só, usada por todos os módulos.

export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Texto seguro para montar HTML.
export const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Formatador com casas fixas; um por quantidade de casas, criado uma vez só.
const formatters = new Map();
export function nf(digits) {
  if (!formatters.has(digits)) formatters.set(digits, new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return formatters.get(digits);
}

export const num = (v) => (v == null ? null : Number(v));
export const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
export const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");

// "2026-11-17" -> "17/11" ; "17/11/2026" ; "2026-11" -> "nov/26".
export const dayMonth = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
export const fullDay = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
export const monthShort = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + "/" + ym.slice(2, 4);

// Estado de falha padrão de uma seção: diz o que faltou e leva à saúde das fontes.
export const failure = (what, hint = "") =>
  '<div class="empty stateFail" role="status"><b>' + esc(what) + " indisponível no momento.</b>" +
  (hint ? "<span>" + esc(hint) + "</span>" : "") +
  '<span>A plataforma tenta de novo sozinha. <button type="button" class="linkish" data-health>Ver saúde das fontes</button></span></div>';
