import { instantAt, localClock, sessionDay } from "./session-calendar.js";
// Bolsas do mundo: horário regular de cada pregão, estado agora (aberto, intervalo,
// fechado) e os índices de cada região, usados pelo bloco "Bolsas agora" (prepos.js).

// Horário regular, no fuso da bolsa. `lunch` marca o intervalo de almoço, quando existe.
export const MARKETS = {
  nyse: { country: "USA", name: "Nova York", venue: "NYSE · Nasdaq", tz: "America/New_York", open: "09:30", close: "16:00" },
  tsx: { country: "CAN", name: "Toronto", venue: "TSX", tz: "America/Toronto", open: "09:30", close: "16:00" },
  b3: { country: "BRA", name: "São Paulo", venue: "B3", tz: "America/Sao_Paulo", open: "10:00", close: "17:00" },
  bcs: { country: "CHL", name: "Santiago", venue: "Bolsa de Santiago", tz: "America/Santiago", open: "09:30", close: "16:00" },
  lse: { country: "GBR", name: "Londres", venue: "LSE", tz: "Europe/London", open: "08:00", close: "16:30" },
  xetra: { country: "DEU", name: "Frankfurt", venue: "Xetra", tz: "Europe/Berlin", open: "09:00", close: "17:30" },
  epa: { country: "FRA", name: "Paris", venue: "Euronext", tz: "Europe/Paris", open: "09:00", close: "17:30" },
  bme: { country: "ESP", name: "Madri", venue: "BME", tz: "Europe/Madrid", open: "09:00", close: "17:30" },
  tse: { country: "JPN", name: "Tóquio", venue: "TSE", tz: "Asia/Tokyo", open: "09:00", close: "15:30", lunch: ["11:30", "12:30"] },
  hkex: { country: "HKG", name: "Hong Kong", venue: "HKEX", tz: "Asia/Hong_Kong", open: "09:30", close: "16:00", lunch: ["12:00", "13:00"] },
  sse: { country: "CHN", name: "Xangai", venue: "SSE", tz: "Asia/Shanghai", open: "09:30", close: "15:00", lunch: ["11:30", "13:00"] },
  nse: { country: "IND", name: "Mumbai", venue: "BSE · NSE", tz: "Asia/Kolkata", open: "09:15", close: "15:30" },
  asx: { country: "AUS", name: "Sydney", venue: "ASX", tz: "Australia/Sydney", open: "10:00", close: "16:00" },
};

export const REGIONS = {
  americas: {
    label: "Américas",
    markets: ["nyse", "tsx", "b3", "bcs"],
    symbols: [
      ["FOREXCOM:DJI", "Dow Jones · contrato"],
      ["FOREXCOM:SPXUSD", "S&P 500 · contrato"],
      ["FOREXCOM:NSXUSD", "Nasdaq 100 · contrato"],
      ["TSX:TSX", "S&P/TSX"],
      ["BMFBOVESPA:IBOV", "Ibovespa"],
      ["BCS:SP_IPSA", "S&P IPSA"],
    ],
  },
  europe: {
    label: "Europa",
    markets: ["lse", "xetra", "epa", "bme"],
    symbols: [
      ["INDEX:SX5E", "Euro Stoxx 50"],
      ["FOREXCOM:UKXGBP", "FTSE 100 · contrato"],
      ["INDEX:DEU40", "DAX 40"],
      ["EURONEXT:PX1", "CAC 40"],
      ["BME:IBC", "IBEX 35"],
    ],
  },
  asia: {
    label: "Ásia-Pacífico",
    markets: ["tse", "hkex", "sse", "nse", "asx"],
    symbols: [
      ["INDEX:NKY", "Nikkei 225"],
      ["OANDA:HK33HKD", "Hang Seng · contrato"],
      ["SSE:000300", "CSI 300"],
      ["BSE:SENSEX", "Sensex"],
      ["OANDA:AU200AUD", "ASX 200 · contrato"],
    ],
  },
  refs: {
    label: "Referências",
    markets: ["nyse", "b3", "lse", "tse"],
    symbols: [
      ["CAPITALCOM:DXY", "Índice do dólar (DXY) · contrato"],
      ["CAPITALCOM:VIX", "Volatilidade (VIX) · contrato"],
      ["FX_IDC:USDBRL", "Dólar em reais"],
      ["TVC:GOLD", "Ouro (US$/onça)"],
      ["TVC:UKOIL", "Petróleo Brent (US$)"],
      ["BITSTAMP:BTCUSD", "Bitcoin (US$)"],
    ],
  },
};

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const span = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min";
};

export function session(market, now = new Date()) {
  const c = localClock(market.tz, now);
  const today = sessionDay(market, c.date);
  const info = { local: c.time, covered: today.covered, holiday: today.holiday };
  if (today.trades && c.time >= today.open && c.time < today.close) {
    if (market.lunch && c.time >= market.lunch[0] && c.time < market.lunch[1])
      return { ...info, state: "lunch", wait: minutes(market.lunch[1]) - minutes(c.time) };
    return { ...info, state: "open", wait: minutes(today.close) - minutes(c.time) };
  }
  const midnight = Date.parse(c.date + "T00:00:00Z");
  for (let d = 0; d < 12; d++) {
    const date = new Date(midnight + d * 86400000).toISOString().slice(0, 10);
    const day = sessionDay(market, date);
    if (today.covered && !day.covered) break;
    if (!day.trades || (!d && c.time >= day.open)) continue;
    const opensAt = new Date(instantAt(date, day.open, market.tz));
    return { ...info, state: "closed", opensAt, nextCovered: day.covered, wait: Math.ceil((opensAt - now) / 60000) };
  }
  return { ...info, state: "closed", wait: null };
}

const here = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const hereTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
export function describe(s, now) {
  if (s.state === "open") return ["Aberto", "fecha em " + span(s.wait)];
  if (s.state === "lunch") return ["Intervalo", "reabre em " + span(s.wait)];
  if (!s.opensAt) return ["Fechado", (s.holiday ? s.holiday + " · " : "") + "próxima sessão a confirmar"];
  const sameDay = s.opensAt && s.opensAt.toDateString() === now.toDateString();
  const when = s.opensAt ? (sameDay ? "hoje " + hereTime.format(s.opensAt) : here.format(s.opensAt).replace(".", "")) : "";
  return ["Fechado", (s.holiday ? s.holiday + " · " : "") + (s.nextCovered ? "abre " : "abertura prevista ") + when];
}
