// Ponto de entrada: monta a moldura, os espaços e cada seção da plataforma.
import { comparison } from "./comparison.js";
import { liveHeat } from "./live-heat.js";
import { capitalFlows } from "./flows.js";
import { fundFlows } from "./funds.js";
import { desks } from "./desks.js";
import { pulse } from "./pulse.js";
import { glossary } from "./glossary.js";
import { agenda } from "./agenda.js";
import { dossier } from "./dossier.js";
import { riskMeter } from "./risk.js";
import { bolsas } from "./prepos.js";
import { pregao } from "./pregao.js";
import { sessionClock } from "./clock.js";
import { fxBoard } from "./fx-board.js";
import { compass, focusCharts } from "./compass.js";
import { cycleClock, recessionSignal } from "./cycle-clock.js";
import { atlas, fmt, timestamp } from "./atlas.js";
import { read, save } from "./storage.js";
import { shell } from "./shell.js";
import { sourceHealth } from "./health.js";
import { about } from "./about.js";
import { tourGuide } from "./tour.js";
import { liveNews } from "./news.js";
import { marketPricing } from "./tesouro.js";
import { inflationQuality } from "./inflation.js";
const $ = (s) => document.querySelector(s);
const compare = comparison({ read, save, fmt, timestamp });
shell({ read, save });
sourceHealth({ button: $("#health"), text: $("#healthText"), dialog: $("#saude") });
about({ dialog: $("#sobre"), openers: [$("#sources"), $("#method")] });
tourGuide({ read, save });
const spaces = desks({ main: $("main"), rail: $(".rail"), read, save, base: "Observatório Econômico Global" });
// Seções de outros espaços só buscam dados e se desenham quando o espaço é aberto.
function whenShown(root, start) {
  const owner = root?.closest("[data-desk]");
  if (!owner || !owner.hidden) return start();
  const watch = new MutationObserver(() => {
    if (owner.hidden) return;
    watch.disconnect();
    start();
  });
  watch.observe(owner, { attributes: true, attributeFilter: ["hidden"] });
}
pulse({ root: $("#pulse") });
liveNews({ root: $("#noticias"), flash: $("#ultima"), read, save });
glossary();
agenda({ week: $("#semana"), full: $("#agenda"), read, save });
riskMeter({ root: $("#termometro") });
whenShown($("#bolsas"), () => bolsas({ root: $("#bolsas"), read, save }));
whenShown($("#pregao"), () => pregao({ root: $("#pregao") }));
sessionClock({ root: $("#relogio") });
whenShown($("#moedas"), () => fxBoard({ root: $("#moedas"), read, save }));
whenShown($("#bussola"), () => compass({ root: $("#bussola") }));
whenShown($("#tesouro"), () => marketPricing({ root: $("#tesouro"), read, save }));
whenShown($("#inflacao"), () => inflationQuality({ root: $("#inflacao"), read, save }));
whenShown($("#focus"), () => focusCharts({ root: $("#focus"), read, save }));
cycleClock({ root: $("#ciclo"), read, save });
recessionSignal({ root: $("#recessionSignal") });
const panorama = atlas({ read, save, compare, spaces });
dossier({
  info: panorama.info,
  read,
  save,
  onMap: (id) => panorama.select(id, true),
  onCompare: (code) => {
    compare.pick(code);
    location.hash = "#comparison";
  },
  onCycle: (id) => {
    window.dispatchEvent(new CustomEvent("oeg:cycle", { detail: id }));
    location.hash = "#ciclo";
  },
});

whenShown($("#aovivo"), () => liveHeat({ root: $("#aovivo"), read, save }));
whenShown($("#fluxo"), () => capitalFlows({ root: $("#fluxo"), read, save }));
whenShown($("#fundos"), () => fundFlows({ root: $("#fundos"), read, save }));

await panorama.ready;
