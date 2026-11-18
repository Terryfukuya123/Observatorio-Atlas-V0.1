import assert from "node:assert/strict";
import { MARKETS, session } from "../web/indices.js";
import { sessionDay } from "../web/session-calendar.js";
import { windows } from "../web/clock.js";

function at(market, iso) {
  return session(MARKETS[market], new Date(iso));
}
function dayWindows(market, date) {
  const from = Date.parse(date + "T00:00:00Z");
  return windows(MARKETS[market], from, from + 86400000);
}
assert.equal(at("b3", "2026-11-20T15:00Z").holiday, "Consciência Negra");
assert.equal(at("b3", "2026-11-19T21:00Z").opensAt.toISOString(), "2026-11-23T13:00:00.000Z");
assert.equal(at("b3", "2026-02-13T22:00Z").opensAt.toISOString(), "2026-02-18T16:00:00.000Z");
assert.equal(at("b3", "2026-02-18T15:59Z").state, "closed");
assert.equal(at("b3", "2026-02-18T16:00Z").state, "open");
assert.equal(at("b3", "2026-11-18T20:59Z").wait, 1);
assert.equal(at("b3", "2026-03-09T20:00Z").state, "closed");
assert.equal(at("nyse", "2026-11-27T17:59Z").wait, 1);
assert.equal(at("nyse", "2026-11-27T18:00Z").state, "closed");
assert.equal(at("nyse", "2026-03-06T21:00Z").opensAt.toISOString(), "2026-03-09T13:30:00.000Z");
assert.equal(at("nyse", "2026-10-30T20:00Z").opensAt.toISOString(), "2026-11-02T14:30:00.000Z");
assert.deepEqual(dayWindows("b3", "2026-11-20"), []);
assert.deepEqual(dayWindows("nyse", "2026-12-24"), [[Date.parse("2026-12-24T14:30Z"), Date.parse("2026-12-24T18:00Z")]]);
assert.equal(sessionDay(MARKETS.b3, "2027-01-01").covered, false);
assert.equal(at("b3", "2026-12-31T17:00Z").wait, null);
assert.equal(at("tse", "2026-11-18T03:00Z").state, "lunch");
console.log("OK · calendário, fusos, sessões especiais e janelas desenhadas");
