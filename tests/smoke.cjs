// Roteiro de fumaça da interface: abre cada espaço no computador e no celular e falha se
// houver erro de script, violação de CSP, arquivo ou dado com erro HTTP, seção em estado
// de falha, seção sem conteúdo ou página mais larga que a tela.
//
// Uso (servidor ativo):  node tests/smoke.cjs [http://127.0.0.1:8842]
// Requer playwright-core acessível ao Node (ver README) e o Edge ou OEG_BROWSER.
const { chromium } = require("playwright-core");

const BASE = process.argv[2] || process.env.OEG_URL || "http://127.0.0.1:8842";
const DESKS = {
  panorama: ["pulse", "termometro", "semana", "relogio", "atlas"],
  mercados: ["prepos", "pregao", "indices", "moedas", "comparison"],
  brasil: ["brasil", "bussola", "fluxo", "fundos"],
  global: ["ciclo", "juros", "agenda", "bulletin"],
};
const VIEWS = { computador: { width: 1440, height: 900 }, celular: { width: 390, height: 844, isMobile: true, hasTouch: true } };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.OEG_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const problems = [];
  try {
    for (const [view, viewport] of Object.entries(VIEWS)) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, locale: "pt-BR" });
      const page = await context.newPage();
      const where = () => view + " · " + new URL(page.url()).hash;
      page.on("pageerror", (e) => problems.push(where() + " · erro de script: " + e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !/tradingview/i.test(m.text())) problems.push(where() + " · console: " + m.text());
      });
      page.on("response", (r) => {
        if (r.url().startsWith(BASE) && r.status() >= 400) problems.push(where() + " · HTTP " + r.status() + " em " + r.url().slice(BASE.length));
      });
      // Primeira visita: o tour aparece, percorre os passos e não volta depois de concluído.
      await page.goto(BASE + "/#/panorama", { waitUntil: "load" });
      await page.waitForSelector(".tour", { timeout: 5000 }).catch(() => problems.push(view + " · tour de boas-vindas não apareceu"));
      for (let i = 0; i < 8 && (await page.locator(".tour [data-tour-next]").count()); i++) {
        const box = await page.locator(".tour").boundingBox();
        if (box && (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1))
          problems.push(view + " · tour passo " + i + " fora da tela");
        await page.click(".tour [data-tour-next]");
        await page.waitForTimeout(150);
      }
      if (await page.locator(".tour").count()) problems.push(view + " · tour não fechou ao concluir");
      console.log("ok  " + view.padEnd(10) + "tour");
      await page.goto(BASE + "/#/panorama", { waitUntil: "load" });
      for (const [desk, sections] of Object.entries(DESKS)) {
        await page.goto(BASE + "/#/" + desk);
        await page.waitForTimeout(2500);
        const report = await page.evaluate(({ desk, sections }) => {
          const visible = (el) => !!el && el.getClientRects().length > 0;
          return {
            title: document.querySelector(".deskHead:not([hidden]) h1")?.textContent,
            missing: sections.filter((id) => !visible(document.getElementById(id))),
            empty: sections.filter((id) => {
              const el = document.getElementById(id);
              return visible(el) && el.innerText.replace(/\s+/g, " ").trim().length < 40;
            }),
            failed: [...document.querySelectorAll(".stateFail")].filter(visible).map((e) => e.closest("[id]")?.id + ": " + e.innerText.split("\n")[0]),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        }, { desk, sections });
        if (!report.title) problems.push(view + " · " + desk + " · espaço não abriu");
        for (const id of report.missing) problems.push(view + " · " + desk + " · seção ausente: #" + id);
        for (const id of report.empty) problems.push(view + " · " + desk + " · seção vazia: #" + id);
        for (const f of report.failed) problems.push(view + " · " + desk + " · falha: " + f);
        if (report.overflow > 2) problems.push(view + " · " + desk + " · página " + report.overflow + "px mais larga que a tela");
        console.log("ok  " + view.padEnd(10) + desk.padEnd(9) + (report.title || "?"));
      }
      // Saúde das fontes abre pelo botão do topo e lista as coletas.
      await page.goto(BASE + "/#/panorama");
      await page.waitForTimeout(1500);
      await page.click("#health");
      await page.waitForSelector("#saude[open] .hsGroup li", { timeout: 5000 }).catch(() => problems.push(view + " · saúde das fontes não abriu"));
      const rows = await page.locator("#saude .hsGroup li").count();
      console.log("ok  " + view.padEnd(10) + "saúde    " + rows + " coletas · " + (await page.locator("#healthText").textContent()));
      // Sobre, fontes e licenças abre pelo endereço #sobre.
      await page.goto(BASE + "/#sobre");
      await page.reload();
      await page.waitForSelector("#sobre[open] .abSources tbody tr", { timeout: 5000 }).catch(() => problems.push(view + " · página Sobre não abriu"));
      const wide = await page.evaluate(() => { const d = document.querySelector("#sobre"); return d ? d.scrollWidth - d.clientWidth : 0; });
      if (wide > 2) problems.push(view + " · página Sobre " + wide + "px mais larga que a janela");
      console.log("ok  " + view.padEnd(10) + "sobre    " + (await page.locator("#sobre .abSources tbody tr").count()) + " fontes");
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (problems.length) {
    console.error("\n" + problems.length + " problema(s):\n- " + [...new Set(problems)].join("\n- "));
    process.exit(1);
  }
  console.log("\nTudo certo: nenhum erro de script, CSP, HTTP, falha ou estouro de largura.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
