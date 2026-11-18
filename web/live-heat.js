// Heatmaps ao vivo com o widget público do TradingView, no mesmo formato do CryptoLab V2.
// Provisório na fase gratuita; ver tv-widget.js.
import { tvTheme, tvWidget, whenVisible } from "./tv-widget.js";

const COMMON = {
  symbolUrl: "",
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  isMonoSize: false,
};
export const VIEWS = {
  crypto: {
    label: "Cripto",
    kind: "crypto-coins-heatmap",
    description:
      "Maiores criptomoedas. O tamanho do bloco é o valor de mercado; a cor, a variação em 24 horas.",
    config: { dataSource: "Crypto", blockSize: "market_cap_calc", blockColor: "24h_close_change|5" },
  },
  us: {
    label: "Ações EUA",
    kind: "stock-heatmap",
    description:
      "Empresas do S&P 500 agrupadas por setor. O tamanho é a capitalização; a cor, a variação do dia. Cotações com atraso de até 15 minutos.",
    config: { exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change" },
  },
  br: {
    label: "Ações Brasil",
    kind: "stock-heatmap",
    description:
      "Empresas do Ibovespa agrupadas por setor. O tamanho é a capitalização; a cor, a variação do dia. Cotações com atraso.",
    config: { exchanges: [], dataSource: "IBOV", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change" },
  },
};

export function liveHeat({ root, read, save }) {
  const host = root.querySelector("#liveHost");
  const desc = root.querySelector("#liveDesc");
  const tabs = [...root.querySelectorAll("[data-live]")];
  let current = VIEWS[read("liveView", "crypto")] ? read("liveView", "crypto") : "crypto";
  let shown = null; // "visão|tema" carregado no momento.

  function mount() {
    const key = current + "|" + tvTheme();
    if (!isVisible() || shown === key) return;
    shown = key;
    const view = VIEWS[current];
    tvWidget(host, {
      kind: view.kind,
      config: { ...COMMON, ...view.config },
      title: "Mapa de calor · " + view.label,
      onFail: () => (shown = null),
    });
  }

  function select(id) {
    if (!VIEWS[id]) return;
    current = id;
    save("liveView", id);
    for (const tab of tabs) tab.setAttribute("aria-pressed", String(tab.dataset.live === id));
    desc.textContent = VIEWS[id].description;
    host.setAttribute("aria-label", "Mapa de calor do TradingView: " + VIEWS[id].label);
    mount();
  }

  for (const tab of tabs) tab.addEventListener("click", () => select(tab.dataset.live));
  const isVisible = whenVisible(host, mount);
  select(current);
}
