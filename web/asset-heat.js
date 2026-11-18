import { cachedFetch } from "./data.js";
const titles = {
  crypto: "Criptomoedas",
  us: "Ações americanas",
  br: "Ações brasileiras",
};
const signed = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
function el(tag, value, css) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (css) node.className = css;
  return node;
}
function link(label, url) {
  const node = el("a", label);
  node.href = url;
  node.target = "_blank";
  node.rel = "noreferrer";
  return node;
}
function fact(list, label, value) {
  const row = el("div", null, "fact");
  row.append(el("b", label), el("span", value));
  list.append(row);
}

export function assetHeat({ $, fmt, timestamp, render }) {
  const selected = {};
  let edition,
    pending,
    failed = false,
    loadedAt = 0;
  const tiles = $("#heatTiles");
  async function load() {
    try {
      const response = await cachedFetch("/api/heatmaps");
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!data.groups || !data.fx?.length) throw Error();
      edition = data;
      failed = false;
      loadedAt = Date.now();
    } catch {
      edition = null;
      failed = true;
    } finally {
      pending = false;
      render();
    }
  }
  function draw(group, base) {
    $(".heatHead h3").textContent = titles[group];
    tiles.setAttribute(
      "aria-label",
      titles[group] + " por variação mensal em " + base,
    );
    const panel = $("#assetDetail");
    const foot = $("#heatFoot");
    tiles.replaceChildren();
    panel.replaceChildren();
    foot.replaceChildren();
    if (!pending && !failed && (!edition || Date.now() - loadedAt > 300000)) {
      pending = true;
      load();
    }
    if (!edition) {
      $("#heatDate").textContent = failed
        ? "Edição mensal indisponível"
        : "Carregando edição mensal…";
      if (failed) {
        const retry = el("button", "Tentar novamente", "contextlink");
        retry.onclick = () => {
          failed = false;
          render();
        };
        tiles.append(retry);
      }
      return;
    }
    const items = [...edition.groups[group]].sort(
      (a, b) =>
        (b.quotes[base]?.percent ?? -Infinity) -
        (a.quotes[base]?.percent ?? -Infinity),
    );
    const item =
      items.find((a) => a.symbol === selected[group]) ||
      items.find((a) => a.funds) ||
      items[0];
    const month = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(edition.to + "T00:00:00Z"));
    $("#heatDate").textContent = month + " · " + base;
    const eligible = items.filter((a) => a.quotes[base]);
    const count = eligible.filter((a) => a.quotes[base].percent > 0).length;
    for (const asset of items) {
      const change = asset.quotes[base]?.percent;
      const dir =
        change == null
          ? "missing"
          : change > 0
            ? "up"
            : change < 0
              ? "down"
              : "flat";
      const strength =
        Math.abs(change) >= 8
          ? "strong"
          : Math.abs(change) >= 2
            ? "medium"
            : "soft";
      const button = el("button", null, "tile " + dir + " " + strength);
      button.dataset.asset = asset.symbol;
      button.setAttribute("aria-pressed", String(asset === item));
      button.append(
        el("strong", asset.symbol),
        el("b", change == null ? "—" : signed.format(change) + "%"),
        el("small", asset.name),
      );
      button.onclick = () => {
        selected[group] = asset.symbol;
        draw(group, base);
        if (window.matchMedia("(max-width: 670px)").matches) {
          const heading = panel.querySelector("h2");
          heading.tabIndex = -1;
          heading.focus();
        } else
          tiles
            .querySelector("button[aria-pressed=true]")
            ?.focus({ preventScroll: true });
      };
      tiles.append(button);
    }
    foot.append(
      el(
        "span",
        count +
          " em alta de " +
          eligible.length +
          " com dados · Blocos de mesmo tamanho",
      ),
      link("CVM · Carteiras declaradas ↗", edition.dataset),
    );
    const now = new Date();
    const expected = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
    )
      .toISOString()
      .slice(0, 10);
    if (edition.to < expected)
      foot.append(el("span", "Aguardando a próxima edição mensal."));
    if (!item) return;
    const quote = item.quotes[base];
    panel.append(
      el("p", titles[group] + " / " + item.symbol, "assetScope"),
      el("h2", item.name),
      el("div", "Marcação por unidade · " + base, "minor"),
      el(
        "strong",
        quote
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: base,
              currencyDisplay: "code",
              maximumFractionDigits: 4,
            }).format(quote.value)
          : "Sem par de observações",
        "assetPrice",
      ),
    );
    if (quote)
      panel.append(
        el(
          "div",
          signed.format(quote.percent) + "% no mês",
          quote.percent > 0
            ? "positive"
            : quote.percent < 0
              ? "negative"
              : "minor",
        ),
      );
    const facts = el("div", null, "facts");
    fact(facts, "Competências", fmt(edition.from) + " – " + fmt(edition.to));
    fact(facts, "Fundos comparáveis", String(item.funds));
    fact(facts, "Fonte", "CVM · CDA mensal");
    panel.append(facts);
    const meta = el("details", null, "assetMethod");
    meta.append(
      el("summary", "Origem e cálculo"),
      el(
        "p",
        "Valor declarado da posição em reais dividido pela quantidade. A cor mostra a mediana das variações mensais dos mesmos fundos, convertidas em " +
          base +
          ". O valor exibido é a mediana das marcações finais por unidade. A amostra cobre posições divulgadas a partir de R$ 100 em cada mês.",
      ),
      el(
        "p",
        "Marcações contábeis mensais, sujeitas a revisão. Sem ajuste por proventos ou desdobramentos. Câmbio de referência gratuito do BCE em " +
          fmt(edition.fx[0].observed) +
          " e " +
          fmt(edition.fx[1].observed) +
          ". Edição gerada em " +
          timestamp(edition.generated) +
          ".",
      ),
      link("Dados da edição", "/api/heatmaps"),
      document.createTextNode(" · "),
      link("Licença ODbL 1.0", edition.license),
    );
    panel.append(meta);
  }
  return { draw };
}
