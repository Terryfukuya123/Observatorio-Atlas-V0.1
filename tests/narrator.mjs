// Escolha da voz e detecção de novidades do narrador.
// Uso: node tests/narrator.mjs
import assert from "node:assert/strict";
import { fresh, pickVoice } from "../web/narrator.js";

const v = (name, lang) => ({ name, lang });
assert.equal(pickVoice([v("Daniel", "pt-BR"), v("Francisca Online (Natural)", "pt-BR"), v("Aria", "en-US")]).name, "Francisca Online (Natural)");
assert.equal(pickVoice([v("Aria", "en-US"), v("Daniel", "pt-BR")]).name, "Daniel");
assert.equal(pickVoice([v("Joana", "pt-PT")]).name, "Joana");
assert.equal(pickVoice([v("Aria", "en-US")]), null);

const events = [{ id: "a", weight: 3 }, { id: "b", weight: 1 }, { id: "c", weight: 2 }];
assert.deepEqual(fresh(events, new Set(["a"])).map((e) => e.id), ["c"]);
assert.deepEqual(fresh(events, new Set(["a", "b", "c"])), []);

console.log("narrator.mjs: ok");
