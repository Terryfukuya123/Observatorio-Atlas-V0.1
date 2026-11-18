import { EVENTS } from "./agenda.js";
// Edição editorial, conferida em 17/11/2026. Cada entrada aponta para seu documento primário.
export const items = [
  {
    group: "BRA",
    market: "Brasil",
    bank: "BCB",
    newsDay: "2026-11-04",
    headline: "Copom mantém a meta Selic na reunião de novembro",
    article:
      "https://www.bcb.gov.br/content/copom/atascopom/Copom282-not20261104282.pdf",
  },
  {
    group: "EMU",
    market: "Zona do euro",
    bank: "BCE",
    newsDay: "2026-10-29",
    headline: "BCE mantém as três taxas de referência na reunião de outubro",
    article:
      "https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html",
  },
  {
    group: "USA",
    market: "Estados Unidos",
    bank: "Fed",
    newsDay: "2026-10-28",
    headline: "FOMC mantém a faixa de juros em votação de outubro",
    article:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
  },
];
function make(tag, text, cls) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function record(item) {
  const row = make("div", "", "publication");
  row.append(
    make(
      "small",
      "Decisão de " + item.newsDay.split("-").reverse().join("/") + "  ·  " + item.bank + "  /  " + item.market,
    ),
  );
  const link = make("a", item.headline);
  link.href = item.article;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.append(make("span", " ↗", "outLink"));
  row.append(link);
  return row;
}
export function renderBulletin() {
  document
    .querySelector("#globalNews")
    .replaceChildren(...items.map((x) => record(x)));
}
export function renderLocalBulletin(country, group) {
  const target = document.querySelector("#localBulletin");
  target.replaceChildren(
    make("h3", country),
    make("small", "Seleção editorial · 17/11/2026"),
  );
  const item = items.find((x) => x.group === group);
  if (item)
    target.append(
      make("h4", "Notícia oficial"),
      record(item),
    );
  const next = EVENTS.find((e) => e.country === group && e.weight === 3 && new Date(e.when) > new Date());
  if (next) {
    const row = make("div", "", "publication");
    row.append(make("small", new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(next.when)) + "  ·  " + country));
    const link = make("a", next.title);
    link.href = "#agenda";
    row.append(link);
    target.append(make("h4", "Próximo grande evento"), row);
  }
  else
    target.append(
      make(
        "p",
        "Esta edição não traz notícias ou eventos para este mercado.",
        "empty",
      ),
    );
  const more = make("a", "Abrir informativo global →", "contextlink");
  more.href = "#bulletin";
  target.append(more);
}
