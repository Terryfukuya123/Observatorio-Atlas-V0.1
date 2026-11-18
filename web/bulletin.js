// Edição editorial, conferida em 17/11/2026. Cada entrada aponta para seu documento primário.
const items = [
  {
    group: "BRA",
    market: "Brasil",
    bank: "BCB",
    newsDay: "2026-11-04",
    headline: "Copom mantém a meta Selic na reunião de novembro",
    article:
      "https://www.bcb.gov.br/content/copom/atascopom/Copom282-not20261104282.pdf",
    event: "Reunião do Copom",
    dates: "8–9 dez 2026",
    calendar:
      "https://www.bcb.gov.br/acessoinformacao/calendariobc?agenda=Reuni%C3%B5es+do+Copom",
  },
  {
    group: "EMU",
    market: "Zona do euro",
    bank: "BCE",
    newsDay: "2026-10-29",
    headline: "BCE mantém as três taxas de referência na reunião de outubro",
    article:
      "https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html",
    event: "Reunião monetária do Conselho do BCE",
    dates: "16–17 dez 2026",
    calendar:
      "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
  },
  {
    group: "USA",
    market: "Estados Unidos",
    bank: "Fed",
    newsDay: "2026-10-28",
    headline: "FOMC mantém a faixa de juros em votação de outubro",
    article:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
    event: "Reunião do FOMC",
    dates: "8–9 dez 2026",
    calendar: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
];
const calendarItems = [items[0], items[2], items[1]];
function make(tag, text, cls) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function record(item, calendar) {
  const row = make("div", "", "publication");
  const date = calendar
    ? item.dates
    : item.newsDay.split("-").reverse().join("/");
  row.append(
    make(
      "small",
      (calendar ? date : "Decisão de " + date) +
        "  ·  " +
        item.bank +
        "  /  " +
        item.market,
    ),
  );
  const link = make("a", calendar ? item.event : item.headline);
  link.href = calendar ? item.calendar : item.article;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.append(make("span", " ↗", "outLink"));
  row.append(link);
  return row;
}
export function renderBulletin() {
  document
    .querySelector("#globalNews")
    .replaceChildren(...items.map((x) => record(x, false)));
  document
    .querySelector("#globalCalendar")
    .replaceChildren(...calendarItems.map((x) => record(x, true)));
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
      record(item, false),
      make("h4", "Calendário econômico"),
      record(item, true),
    );
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
