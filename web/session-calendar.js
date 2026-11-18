// Calendários de ações da B3 e NYSE para 2026. Fontes no rodapé do relógio.
const holidays = {
  BRA: {
    "01-01": "Ano-Novo", "02-16": "Carnaval", "02-17": "Carnaval",
    "04-03": "Sexta-feira Santa", "04-21": "Tiradentes", "05-01": "Dia do Trabalho",
    "06-04": "Corpus Christi", "09-07": "Independência", "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados", "11-20": "Consciência Negra", "12-24": "Véspera de Natal",
    "12-25": "Natal", "12-31": "Véspera de Ano-Novo",
  },
  USA: {
    "01-01": "Ano-Novo", "01-19": "Martin Luther King Jr. Day", "02-16": "Washington’s Birthday",
    "04-03": "Sexta-feira Santa", "05-25": "Memorial Day", "06-19": "Juneteenth",
    "07-03": "Independência dos EUA (observada)", "09-07": "Labor Day",
    "11-26": "Thanksgiving", "12-25": "Natal",
  },
};
const formats = new Map();
export function localClock(tz, now) {
  if (!formats.has(tz)) formats.set(tz, new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }));
  const p = Object.fromEntries(formats.get(tz).formatToParts(now).map(part => [part.type, part.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, time: p.hour + ":" + p.minute };
}

export function sessionDay(market, date) {
  const wd = new Date(date + "T00:00:00Z").getUTCDay();
  const covered = Boolean(holidays[market.country]) && date.startsWith("2026-");
  const md = date.slice(5);
  const holiday = covered && holidays[market.country][md];
  let { open, close } = market;
  if (covered && market.country === "BRA") {
    if (md === "02-18") open = "13:00";
    close = md < "03-09" || md >= "11-03" ? "18:00" : "17:00";
  }
  if (covered && market.country === "USA" && ["11-27", "12-24"].includes(md)) close = "13:00";
  return { open, close, holiday, covered, trades: wd !== 0 && wd !== 6 && !holiday };
}

export function instantAt(date, time, tz) {
  const target = Date.parse(date + "T" + time + ":00Z");
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const local = localClock(tz, guess);
    guess += target - Date.parse(local.date + "T" + local.time + ":00Z");
  }
  return guess;
}
