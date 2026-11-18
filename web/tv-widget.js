// Carregador comum dos widgets públicos do TradingView.
// Uso provisório na fase gratuita: os termos do TradingView vetam uso comercial sem acordo.
// Antes de cobrar assinatura, fechar acordo ou trocar os módulos que dependem deste arquivo.
// O widget roda num iframe do próprio TradingView, com a atribuição original visível;
// nada passa pelo servidor do Observatório.

const BASE = "https://s3.tradingview.com/external-embedding/embed-widget-";
const TIMEOUT = 15000;
const runs = new WeakMap();

export const tvTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

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
}

// Monta (ou remonta) um widget em `host`. `kind` é o nome do widget, como "stock-heatmap".
export function tvWidget(host, { kind, config, title, onFail }) {
  runs.get(host)?.abort();
  if (document.documentElement.dataset.profile === "profissional") {
    host.dataset.status = "restricted";
    message(host, "Widget indisponível neste perfil", "A exibição profissional depende de acordo com o TradingView.");
    return;
  }
  const run = new AbortController();
  runs.set(host, run);
  const current = () => !run.signal.aborted;
  host.dataset.status = "loading";
  message(host, "Conectando ao TradingView", "O widget público pode levar alguns segundos para responder.");
  const fail = (text) => {
    if (!current()) return;
    run.abort();
    host.dataset.status = "error";
    onFail?.();
    message(host, text, "", () => tvWidget(host, { kind, config, title, onFail }));
  };
  const timer = setTimeout(() => fail("Dados temporariamente indisponíveis"), TIMEOUT);
  const container = document.createElement("div");
  container.className = "tradingview-widget-container";
  const slot = document.createElement("div");
  slot.className = "tradingview-widget-container__widget";
  container.append(slot);
  const observer = new MutationObserver(() => {
    const frame = container.querySelector("iframe");
    if (!frame) return;
    observer.disconnect();
    frame.title = title + " · TradingView";
    frame.addEventListener(
      "load",
      () => {
        if (!current()) return;
        clearTimeout(timer);
        host.dataset.status = "loaded";
        host.querySelector(".liveState")?.remove();
      },
      { once: true, signal: run.signal },
    );
  });
  run.signal.addEventListener("abort", () => { clearTimeout(timer); observer.disconnect(); }, { once: true });
  observer.observe(container, { childList: true, subtree: true });
  const script = document.createElement("script");
  script.async = true;
  script.src = BASE + kind + ".js";
  // O script lê a configuração do próprio texto; com src definido, o texto não é executado.
  script.textContent = JSON.stringify({ locale: "br", width: "100%", height: "100%", ...config, colorTheme: tvTheme() });
  script.onerror = () => {
    observer.disconnect();
    clearTimeout(timer);
    fail("Falha ao carregar o widget");
  };
  container.append(script);
  host.append(container);
}

// Chama `fn` quando o elemento aparece na tela pela primeira vez e a cada troca de tema.
export function whenVisible(element, fn) {
  let visible = false;
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      visible = true;
      observer.disconnect();
      fn();
    },
    { rootMargin: "200px" },
  ).observe(element);
  new MutationObserver(() => visible && fn()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => visible;
}
