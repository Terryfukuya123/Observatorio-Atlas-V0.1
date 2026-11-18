// Regras de concordância, frescor e confiança do termômetro de risco.
// Uso: node tests/risk.mjs
import assert from "node:assert/strict";
import { consensus, freshness, trust } from "../web/risk.js";

const TODAY = new Date(2026, 10, 18);
const sig = (group, score, asOf = "2026-11-17", cadence = "daily", name = "s") => ({ group, name, now: { score, asOf, cadence } });

// Frescor conta a partir do fim do período: mês fechado vale até o último dia.
assert.deepEqual(freshness("2026-11-17", "daily", TODAY), { age: 1, stale: false });
assert.deepEqual(freshness("2026-11-10", "daily", TODAY), { age: 8, stale: true });
assert.deepEqual(freshness("2026-10", "monthly", TODAY), { age: 18, stale: false });
assert.equal(freshness("2026-07", "bop", TODAY).stale, true);
assert.equal(freshness(null, "daily", TODAY), null);

// Concordância.
const aligned = consensus([sig("Mundo", 2), sig("Mundo", 1), sig("Brasil", 1), sig("Brasil", 0)]);
assert.equal(aligned.label, "alinhados");
assert.equal(aligned.pos, 3);
const split = consensus([sig("Mundo", -2), sig("Mundo", -1), sig("Mundo", -1), sig("Brasil", 1), sig("Brasil", 2)]);
assert.equal(split.label, "divididos");
assert.ok(split.world < 0 && split.brazil > 0);
assert.equal(consensus([sig("Mundo", 0), sig("Brasil", 0)]).label, "sem direção");
assert.equal(consensus([sig("Mundo", 2), sig("Mundo", 1), sig("Brasil", -1), sig("Brasil", 0), sig("Brasil", 0), sig("Brasil", 0)]).label, "mistos");

// Confiança: cobertura, frescor e concordância.
const full = Array.from({ length: 9 }, (_, i) => sig(i < 4 ? "Mundo" : "Brasil", 1, "2026-11-17", "daily", "s" + i));
assert.equal(trust(full, consensus(full), TODAY).level, "alta");
const old = full.map((c, i) => (i < 3 ? { ...c, now: { ...c.now, asOf: "2026-10-01" } } : c));
assert.equal(trust(old, consensus(old), TODAY).level, "baixa");
const gap = [...full.slice(0, 8), { group: "Brasil", name: "faltando", now: null }];
const t = trust(gap, consensus(gap), TODAY);
assert.deepEqual([t.level, t.missing], ["média", ["faltando"]]);

console.log("risk.mjs: ok");
