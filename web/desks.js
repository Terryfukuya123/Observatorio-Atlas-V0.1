// Espaços de análise: a página única vira quatro espaços (Panorama, Mercados, Brasil,
// Global). Cada um abre com uma pergunta, os atalhos das suas partes e termina com o
// caminho natural para continuar a análise. O endereço (#/brasil ou #fluxo) define o
// espaço, então links antigos para as seções continuam funcionando.

export const DESKS = {
  panorama: {
    title: "Panorama",
    icon: "globe",
    lead: "O essencial do dia num só olhar. Cada indicador abre a análise completa.",
    parts: [
      ["pulse", "Pulso do dia"],
      ["relogio", "Relógio dos pregões"],
      ["atlas", "Mapa e ficha do país"],
    ],
    next: [
      ["#fluxo", "Brasil", "Quem trouxe e quem tirou dinheiro do país"],
      ["#indices", "Mercados", "Bolsas abertas agora e índices do dia"],
      ["#juros", "Global", "Juros dos EUA e ciclo das economias"],
    ],
  },
  mercados: {
    title: "Mercados",
    icon: "grid",
    lead: "Como estão as bolsas, os setores e as moedas agora.",
    parts: [
      ["indices", "Índices mundiais"],
      ["aovivo", "Mapas de calor"],
      ["moedas", "Força das moedas"],
      ["comparison", "Comparador de câmbio"],
      ["markets", "Mercados acompanhados"],
    ],
    next: [
      ["#fluxo", "Brasil", "O fluxo de capital por trás do câmbio e da bolsa"],
      ["#juros", "Global", "A curva de juros dos EUA, que move o dólar"],
      ["#pulse", "Panorama", "Voltar ao resumo do dia"],
    ],
  },
  brasil: {
    title: "Brasil",
    icon: "flow",
    lead: "Juros, inflação e atividade, e para onde foi o dinheiro: do câmbio aos fundos.",
    parts: [
      ["bussola", "Bússola dos juros"],
      ["brasil", "Indicadores"],
      ["focus", "Expectativas · Focus"],
      ["fluxo", "Fluxo cambial"],
      ["fundos", "Fundos"],
    ],
    next: [
      ["#juros", "Global", "Juros americanos: o outro lado do diferencial de juros"],
      ["#aovivo", "Mercados", "Ibovespa por setor no mapa de calor"],
      ["#comparison", "Mercados", "Real contra outras moedas"],
    ],
  },
  global: {
    title: "Global",
    icon: "layers",
    lead: "Juros, ciclo econômico e a agenda que move os mercados.",
    parts: [
      ["juros", "Juros e ciclo"],
      ["bulletin", "Notícias e agenda"],
    ],
    next: [
      ["#indices", "Mercados", "Como as bolsas reagem agora"],
      ["#brasil", "Brasil", "Selic, inflação e expectativas no Brasil"],
      ["#atlas", "Panorama", "Indicadores por país no mapa"],
    ],
  },
};

const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function desks({ main, rail, read, save, base = document.title }) {
  const members = (desk) => [...main.querySelectorAll(':scope > [data-desk="' + desk + '"]')];
  const heads = {};
  let current = null;
  let spyFrame = 0;

  // Cabeçalho e fechamento de cada espaço.
  for (const [id, desk] of Object.entries(DESKS)) {
    const items = members(id);
    if (!items.length) continue;
    const head = document.createElement("header");
    head.className = "deskHead";
    head.dataset.desk = id;
    head.innerHTML =
      '<p class="crumb">Observatório <span>/</span> ' + esc(desk.title) + "</p>" +
      "<h1>" + esc(desk.title) + "</h1>" +
      '<p class="deskLead">' + esc(desk.lead) + "</p>";
    const bar = document.createElement("nav");
    bar.className = "deskBar";
    bar.dataset.desk = id;
    bar.setAttribute("aria-label", "Partes de " + desk.title);
    bar.innerHTML = desk.parts
      .filter(([part]) => document.getElementById(part))
      .map(([part, label]) => '<a href="#' + part + '" data-part="' + part + '">' + esc(label) + "</a>")
      .join("");
    items[0].before(head, bar);
    const foot = document.createElement("nav");
    foot.className = "deskNext";
    foot.dataset.desk = id;
    foot.setAttribute("aria-label", "Continuar a análise");
    foot.innerHTML =
      "<h2>Continue a análise</h2><div>" +
      desk.next
        .map(([href, space, text]) =>
          '<a href="' + href + '"><small>' + esc(space) + "</small><span>" + esc(text) + '</span><b aria-hidden="true">→</b></a>')
        .join("") +
      "</div>";
    items.at(-1).after(foot);
    heads[id] = { head, bar };
  }

  function deskOf(hash) {
    if (hash.startsWith("#/")) {
      const id = hash.slice(2);
      return DESKS[id] ? { desk: id, target: null } : null;
    }
    const target = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    const owner = target && target.closest("[data-desk]");
    if (!owner) return null;
    return { desk: owner.dataset.desk, target: owner === target && heads[owner.dataset.desk] && members(owner.dataset.desk)[0] === target ? null : target };
  }

  function show(desk) {
    if (desk === current) return false;
    current = desk;
    for (const el of main.querySelectorAll(":scope > [data-desk]")) el.hidden = el.dataset.desk !== desk;
    for (const link of rail.querySelectorAll("a[data-desk]")) {
      const on = link.dataset.desk === desk;
      link.classList.toggle("active", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = DESKS[desk].title + " · " + base;
    document.documentElement.dataset.desk = desk;
    save("desk", desk);
    // Gráficos que medem o próprio tamanho precisam recalcular ao aparecer.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return true;
  }

  function route() {
    const found = deskOf(location.hash) || { desk: location.hash ? "panorama" : read("desk", "panorama"), target: null };
    if (!DESKS[found.desk]) found.desk = "panorama";
    const changed = show(found.desk);
    if (found.target) requestAnimationFrame(() => found.target.scrollIntoView({ block: "start" }));
    else if (changed) window.scrollTo(0, 0);
    spy();
  }

  // Marca a parte visível na barra do espaço.
  function spy() {
    cancelAnimationFrame(spyFrame);
    spyFrame = requestAnimationFrame(() => {
      const bar = heads[current]?.bar;
      if (!bar) return;
      const offset = bar.getBoundingClientRect().bottom + 24;
      let active = null;
      for (const link of bar.querySelectorAll("a")) {
        const el = document.getElementById(link.dataset.part);
        const top = el?.getBoundingClientRect().top;
        if (top == null) continue;
        // No fim da página a última parte pode não chegar ao topo: basta estar visível.
        const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        if (top <= offset || (bottom && top < window.innerHeight * 0.6)) active = link;
      }
      active ||= bar.querySelector("a");
      for (const link of bar.querySelectorAll("a")) link.classList.toggle("active", link === active);
    });
  }

  // Um link para o endereço atual não gera hashchange: refaz a rota mesmo assim.
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.getAttribute("href") === location.hash) {
      event.preventDefault();
      route();
    }
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", spy, { passive: true });
  route();
  return { show: (desk) => (location.hash = "#/" + desk), current: () => current };
}
