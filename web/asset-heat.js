import { sectorMap } from "./sector-map.js";
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
  const marketMap = sectorMap(tiles);
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

    panel.replaceChildren();
    foot.replaceChildren();
    if (!pending && !failed && (!edition || Date.now() - loadedAt > 300000)) {
      pending = true;
      load();
    }
    if (!edition) {
      tiles.replaceChildren();
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
    marketMap({group, base, items: edition.groups[group], selected: item?.symbol, choose(symbol) {
      selected[group] = symbol;
      draw(group, base);
    }});
    foot.append(
      el(
        "span",
        count +
          " em alta de " +
          eligible.length +
          " com variação mensal",
      ),
      link("CVM · Carteiras declaradas ↗", edition.dataset),
    );
    const liveLink = el("a", "Abrir mapa de mercado ↗");
    liveLink.href = "#live-" + group;
    foot.append(liveLink);
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
    fact(facts, "Setor", item.sector || "Sem classificação");
    for (const [field, title] of [["position","Posições dos fundos"], ["volume","Compras + vendas"]]) {
      const weight = item[field];
      const total = items.reduce((sum,a)=>sum+(a[field]||0),0);
      const amount = weight == null ? "Não informado" :
        new Intl.NumberFormat("pt-BR", {style:"currency",currency:base,notation:"compact"}).format(weight/Number(edition.fx[1][base]));
      fact(facts, title, amount + (weight != null && total ? " · " + (100*weight/total).toLocaleString("pt-BR",{maximumFractionDigits:2})+"% da cesta" : ""));
    }
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
    meta.append(el("p","A área usa a posição final ou a soma de compras e vendas declaradas pelos fundos para os ativos desta cesta. Os valores em moeda-base usam o câmbio de fim de mês. Uma informação de negociação ausente aparece como indisponível."));
    panel.append(meta);
  }
  return { draw };
}
