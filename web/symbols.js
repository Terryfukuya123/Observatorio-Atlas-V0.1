// Bandeiras e selos de moeda desenhados pelo Observatório (SVG próprio, sem dependência
// externa). Bandeiras simplificadas para leitura em 14–24 px, no padrão de mercado:
// país em retângulo, moeda em círculo e par cambial em dois círculos sobrepostos.

const W = 30;
const H = 20;
const rect = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
const rows = (...c) => c.map((k, i) => rect(0, (H / c.length) * i, W, H / c.length + 0.05, k)).join("");
const cols = (...c) => c.map((k, i) => rect((W / c.length) * i, 0, W / c.length + 0.05, H, k)).join("");
const circle = (cx, cy, r, c) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '"/>';
const poly = (pts, c) => '<polygon points="' + pts + '" fill="' + c + '"/>';
const nordic = (bg, cross, inner) =>
  rect(0, 0, W, H, bg) + rect(8, 0, 5, H, cross) + rect(0, 7.5, W, 5, cross) + (inner ? rect(9.3, 0, 2.4, H, inner) + rect(0, 8.8, W, 2.4, inner) : "");
function star(cx, cy, r, c) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r * 0.42 : r;
    p.push((cx + k * Math.cos(a)).toFixed(2) + "," + (cy + k * Math.sin(a)).toFixed(2));
  }
  return poly(p.join(" "), c);
}
const union = (s = 1) =>
  '<g transform="scale(' + s + ')">' + rect(0, 0, W, H, "#012169") +
  '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/>' +
  '<path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.4"/>' +
  rect(12, 0, 6, H, "#fff") + rect(0, 7, W, 6, "#fff") + rect(13.2, 0, 3.6, H, "#c8102e") + rect(0, 8.2, W, 3.6, "#c8102e") + "</g>";

const FLAGS = {
  BRA: () => rect(0, 0, W, H, "#009c3b") + poly("3,10 15,2.2 27,10 15,17.8", "#ffdf00") + circle(15, 10, 4.6, "#002776") +
    '<path d="M10.6 9.2q4.6-1.2 8.8 1.6" stroke="#fff" stroke-width="0.8" fill="none"/>',
  USA: () => rect(0, 0, W, H, "#fff") + Array.from({ length: 7 }, (_, i) => rect(0, i * (H / 6.5), W, H / 13, "#b22234")).join("") +
    rect(0, 0, 12, 10.8, "#3c3b6e") +
    Array.from({ length: 12 }, (_, i) => circle(1.6 + (i % 4) * 2.9, 1.9 + Math.floor(i / 4) * 3.4, 0.55, "#fff")).join(""),
  CAN: () => cols("#d52b1e", "#fff", "#fff", "#d52b1e") +
    poly("15,4 16.1,6.6 18.2,5.9 17.5,9.6 19.6,8.9 19.2,10.6 20.4,11.2 16,14 16.3,15.9 13.7,15.9 14,14 9.6,11.2 10.8,10.6 10.4,8.9 12.5,9.6 11.8,5.9 13.9,6.6", "#d52b1e"),
  MEX: () => cols("#006847", "#fff", "#ce1126") + circle(15, 10, 2.6, "#8c5a2b"),
  ARG: () => rows("#74acdf", "#fff", "#74acdf") + circle(15, 10, 2, "#f6b40e"),
  CHL: () => rect(0, 0, W, 10, "#fff") + rect(0, 10, W, 10, "#d52b1e") + rect(0, 0, 10, 10, "#0039a6") + star(5, 5, 2.6, "#fff"),
  COL: () => rect(0, 0, W, 10, "#fcd116") + rect(0, 10, W, 5, "#003893") + rect(0, 15, W, 5, "#ce1126"),
  PER: () => cols("#d91023", "#fff", "#d91023"),
  GBR: () => union(),
  DEU: () => rows("#000", "#dd0000", "#ffce00"),
  FRA: () => cols("#002395", "#fff", "#ed2939"),
  ITA: () => cols("#009246", "#fff", "#ce2b37"),
  ESP: () => rect(0, 0, W, H, "#aa151b") + rect(0, 5, W, 10, "#f1bf00"),
  PRT: () => rect(0, 0, 12, H, "#006600") + rect(12, 0, 18, H, "#ff0000") + circle(12, 10, 3.6, "#ffcc00") + circle(12, 10, 2.2, "#ff0000"),
  NLD: () => rows("#ae1c28", "#fff", "#21468b"),
  BEL: () => cols("#000", "#fdda24", "#ef3340"),
  CHE: () => rect(0, 0, W, H, "#d52b1e") + rect(13, 4, 4, 12, "#fff") + rect(9, 8, 12, 4, "#fff"),
  AUT: () => rows("#ed2939", "#fff", "#ed2939"),
  IRL: () => cols("#169b62", "#fff", "#ff883e"),
  SWE: () => nordic("#006aa7", "#fecc00"),
  NOR: () => nordic("#ba0c2f", "#fff", "#00205b"),
  DNK: () => nordic("#c8102e", "#fff"),
  FIN: () => nordic("#fff", "#002f6c"),
  POL: () => rows("#fff", "#dc143c"),
  RUS: () => rows("#fff", "#0039a6", "#d52b1e"),
  GRC: () => Array.from({ length: 9 }, (_, i) => rect(0, (H / 9) * i, W, H / 9 + 0.05, i % 2 ? "#fff" : "#0d5eaf")).join("") +
    rect(0, 0, 11.1, 11.1, "#0d5eaf") + rect(4.45, 0, 2.2, 11.1, "#fff") + rect(0, 4.45, 11.1, 2.2, "#fff"),
  TUR: () => rect(0, 0, W, H, "#e30a17") + circle(11, 10, 5, "#fff") + circle(12.3, 10, 4, "#e30a17") + star(17.6, 10, 2.3, "#fff"),
  JPN: () => rect(0, 0, W, H, "#fff") + circle(15, 10, 6, "#bc002d"),
  CHN: () => rect(0, 0, W, H, "#de2910") + star(5.5, 5.5, 3.2, "#ffde00") + star(10.5, 2.4, 0.9, "#ffde00") + star(12.3, 4.6, 0.9, "#ffde00") +
    star(12.3, 7.6, 0.9, "#ffde00") + star(10.5, 9.6, 0.9, "#ffde00"),
  HKG: () => rect(0, 0, W, H, "#de2910") +
    Array.from({ length: 5 }, (_, i) => '<ellipse cx="15" cy="7" rx="1.6" ry="3" fill="#fff" transform="rotate(' + i * 72 + ' 15 10)"/>').join(""),
  KOR: () => rect(0, 0, W, H, "#fff") + '<path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0"/>' +
    '<path d="M4 4.5l3-2M5 5.5l3-2M23 2.5l3 2M22 3.5l3 2M4 15.5l3 2M5 14.5l3 2M23 17.5l3-2M22 16.5l3-2" stroke="#000" stroke-width="0.7"/>',
  IND: () => rows("#ff9933", "#fff", "#138808") + '<circle cx="15" cy="10" r="2.5" fill="none" stroke="#000080" stroke-width="0.7"/>',
  IDN: () => rows("#ce1126", "#fff"),
  AUS: () => rect(0, 0, W, H, "#012169") + union(0.5) + star(7.5, 15.5, 2, "#fff") + star(23, 5, 1.1, "#fff") + star(20, 9.5, 1.1, "#fff") +
    star(26, 9, 1.1, "#fff") + star(23, 16, 1.1, "#fff"),
  NZL: () => rect(0, 0, W, H, "#012169") + union(0.5) + star(23, 5, 1.2, "#c8102e") + star(20, 9.5, 1.2, "#c8102e") + star(26, 9, 1.2, "#c8102e") +
    star(23, 16, 1.2, "#c8102e"),
  SGP: () => rect(0, 0, W, 10, "#ef3340") + rect(0, 10, W, 10, "#fff") + circle(6.5, 5, 3.2, "#fff") + circle(7.8, 5, 3, "#ef3340"),
  ZAF: () => rect(0, 0, W, 10, "#e03c31") + rect(0, 10, W, 10, "#001489") +
    '<path d="M0 0L13 10L0 20M13 10H30" stroke="#fff" stroke-width="6.6" fill="none"/>' +
    '<path d="M0 0L13 10L0 20M13 10H30" stroke="#007749" stroke-width="4" fill="none"/>' +
    poly("0,2.2 10.2,10 0,17.8", "#ffb81c") + poly("0,4 8,10 0,16", "#000"),
  SAU: () => rect(0, 0, W, H, "#006c35") + rect(8, 13, 14, 1.2, "#fff"),
  ISR: () => rect(0, 0, W, H, "#fff") + rect(0, 2, W, 3, "#0038b8") + rect(0, 15, W, 3, "#0038b8") +
    '<path d="M15 6.4l3.2 5.4h-6.4zM15 13.6l3.2-5.4h-6.4z" fill="none" stroke="#0038b8" stroke-width="0.8"/>',
  EMU: () => rect(0, 0, W, H, "#003399") +
    Array.from({ length: 12 }, (_, i) => star(15 + 6 * Math.cos((i * Math.PI) / 6), 10 + 6 * Math.sin((i * Math.PI) / 6), 0.9, "#ffcc00")).join(""),
};
FLAGS.EUR = FLAGS.EMU;

export const CURRENCY_COUNTRY = {
  USD: "USA", EUR: "EMU", BRL: "BRA", GBP: "GBR", JPY: "JPN", CNY: "CHN", HKD: "HKG", INR: "IND", AUD: "AUS", CAD: "CAN",
  CHF: "CHE", MXN: "MEX", KRW: "KOR", ZAR: "ZAF", TRY: "TUR", ARS: "ARG", CLP: "CHL", COP: "COL", NZD: "NZL", SGD: "SGP",
  SEK: "SWE", NOK: "NOR", DKK: "DNK", PLN: "POL", IDR: "IDN", SAR: "SAU", ILS: "ISR", RUB: "RUS",
};

const has = (iso) => Boolean(FLAGS[iso]);
// Recorte do círculo: bandeiras com cantão ficam alinhadas à esquerda para manter o símbolo.
const CROP = { USA: 0, CHL: 0, GRC: 0, AUS: 1, NZL: 1, SGP: 0, CHN: 0 };
const view = (iso) => (CROP[iso] ?? 5) + " 0 20 20";
const label = (text) => (text ? ' role="img" aria-label="' + String(text).replace(/"/g, "&quot;") + '"' : ' aria-hidden="true"');

// Bandeira retangular do país (ISO3). Sem desenho: selo com o código.
export function flag(iso, name = "") {
  if (!has(iso)) return '<span class="flag flagCode"' + label(name) + ">" + String(iso || "").slice(0, 3) + "</span>";
  return '<svg class="flag" viewBox="0 0 30 20"' + label(name) + ">" + FLAGS[iso]() + "</svg>";
}

// Moeda em círculo: bandeira do emissor recortada. Bitcoin e áreas sem bandeira viram selo.
export function coin(code, name = "") {
  if (code === "BTC")
    return '<svg class="coin" viewBox="0 0 20 20"' + label(name || "Bitcoin") + '><circle cx="10" cy="10" r="10" fill="#f7931a"/>' +
      '<text x="10" y="14.2" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">₿</text></svg>';
  const iso = CURRENCY_COUNTRY[code] || code;
  if (!has(iso)) return '<span class="coin coinCode"' + label(name || code) + ">" + String(code || "").slice(0, 3) + "</span>";
  return '<svg class="coin" viewBox="' + view(iso) + '"' + label(name || code) + ">" + FLAGS[iso]() + "</svg>";
}

// País ou bloco em círculo (para listas compactas).
export function round(iso, name = "") {
  if (iso === "G20" || iso === "G7" || iso === "OCDE")
    return '<span class="coin coinCode coinGroup"' + label(name || iso) + ">" + iso + "</span>";
  if (!has(iso)) return '<span class="coin coinCode"' + label(name) + ">" + String(iso || "").slice(0, 3) + "</span>";
  return '<svg class="coin" viewBox="' + view(iso) + '"' + label(name) + ">" + FLAGS[iso]() + "</svg>";
}

// Par cambial: duas moedas sobrepostas, como nas plataformas de mercado.
export function pair(base, quote) {
  return '<span class="pairIcon" aria-hidden="true">' + coin(base) + coin(quote) + "</span>";
}

// Bandeira circular dentro de outro SVG (gráficos): centro e tamanho em unidades do SVG pai.
// `key` deixa o recorte com identificador único no documento.
export function flagAt(iso, cx, cy, size, key = "") {
  const r = (size / 2).toFixed(1);
  const c = cx.toFixed(1) + '" cy="' + cy.toFixed(1);
  if (!has(iso))
    return '<g class="flagAt flagGroup"><circle cx="' + c + '" r="' + r + '"/><text x="' + cx.toFixed(1) + '" y="' + (cy + size * 0.13).toFixed(1) + '">' +
      String(iso).slice(0, 3) + "</text></g>";
  const id = "fc-" + key + iso;
  return '<g class="flagAt"><clipPath id="' + id + '"><circle cx="' + c + '" r="' + r + '"/></clipPath><g clip-path="url(#' + id + ')"><svg x="' +
    (cx - size / 2).toFixed(1) + '" y="' + (cy - size / 2).toFixed(1) + '" width="' + size + '" height="' + size + '" viewBox="' + view(iso) + '">' +
    FLAGS[iso]() + '</svg></g><circle class="flagRing" cx="' + c + '" r="' + r + '"/></g>';
}
