// Heatmaps ao vivo com o widget público do TradingView, no mesmo formato do CryptoLab V2.
// Módulo isolado e trocável: os termos do TradingView vetam uso comercial sem acordo,
// então antes de cobrar assinatura é preciso fechar acordo ou substituir este módulo.
// Nada aqui é armazenado nem passa pelo servidor do Observatório; o widget roda num
// iframe do próprio TradingView, com a atribuição original visível.

const SCRIPT = {
  crypto: "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js",
  stock: "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",
};
const COMMON = {
  locale: "br",
  symbolUrl: "",
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  isMonoSize: false,
  width: "100%",
  height: "100%",
};
export const VIEWS = {
  crypto: {
    label: "Cripto",
    script: SCRIPT.crypto,
    description:
      "Maiores criptomoedas. O tamanho do bloco é o valor de mercado; a cor, a variação em 24 horas.",
    config: { dataSource: "Crypto", blockSize: "market_cap_calc", blockColor: "24h_close_change|5" },
  },
  us: {
    label: "Ações EUA",
    script: SCRIPT.stock,
    description:
      "Empresas do S&P 500 agrupadas por setor. O tamanho é a capitalização; a cor, a variação do dia. Cotações com atraso de até 15 minutos.",
    config: { exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change" },
  },
  br: {
    label: "Ações Brasil",
    script: SCRIPT.stock,
    description:
      "Empresas do Ibovespa agrupadas por setor. O tamanho é a capitalização; a cor, a variação do dia. Cotações com atraso.",
    config: { exchanges: [], dataSource: "IBOV", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change" },
  },
};
const TIMEOUT = 15000;

function message(host, title, detail, retry) {
  const box = document.createElement("div");
  box.className = "liveState";
  box.setAttribute("role", "status");
  const strong = document.createElement("strong");
  strong.textContent = title;
  box.append(strong);
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    box.append(small);
  }
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "contextlink";
    button.textContent = "Tentar novamente";
    button.onclick = retry;
    box.append(button);
  }
  host.replaceChildren(box);
  return box;
}

export function liveHeat({ root, read, save }) {
  const host = root.querySelector("#liveHost");
  const desc = root.querySelector("#liveDesc");
  const tabs = [...root.querySelectorAll("[data-live]")];
  let current = VIEWS[read("liveView", "crypto")] ? read("liveView", "crypto") : "crypto";
  let shown = null; // "visão|tema" carregado no momento.
  let visible = false;
  let generation = 0;

  const theme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

  function mount() {
    const view = VIEWS[current];
    const key = current + "|" + theme();
    if (!visible || shown === key) return;
    shown = key;
    const run = ++generation;
    host.dataset.status = "loading";
    message(host, "Conectando ao mapa", "O widget público do TradingView pode levar alguns segundos para responder.");
    const fail = (text) => {
      if (run !== generation) return;
      host.dataset.status = "error";
      shown = null;
      message(host, text, "", () => mount());
    };
    const timer = setTimeout(() => fail("Mapa temporariamente indisponível"), TIMEOUT);
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.append(widget);
    const observer = new MutationObserver(() => {
      const frame = container.querySelector("iframe");
      if (!frame) return;
      observer.disconnect();
      frame.title = "Mapa de calor · " + view.label + " · TradingView";
      frame.addEventListener(
        "load",
        () => {
          if (run !== generation) return;
          clearTimeout(timer);
          host.dataset.status = "loaded";
          host.querySelector(".liveState")?.remove();
        },
        { once: true },
      );
    });
    observer.observe(container, { childList: true, subtree: true });
    const script = document.createElement("script");
    script.async = true;
    script.src = view.script;
    // O script do widget lê a configuração do próprio texto; com src definido, o texto não é executado.
    script.textContent = JSON.stringify({ ...COMMON, ...view.config, colorTheme: theme() });
    script.onerror = () => {
      observer.disconnect();
      clearTimeout(timer);
      fail("Falha ao carregar o mapa");
    };
    container.append(script);
    host.append(container);
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
  // Só carrega o widget quando a seção aparece na tela: evita tráfego e rastreamento à toa.
  new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      visible = true;
      mount();
    },
    { rootMargin: "200px" },
  ).observe(host);
  // Troca de tema recarrega o widget com as cores certas.
  new MutationObserver(() => mount()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  select(current);
}
