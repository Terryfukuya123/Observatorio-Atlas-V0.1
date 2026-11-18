const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.OEG_BROWSER ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      locale: "pt-BR",
    });
    await page.addInitScript(() => localStorage.setItem("oeg.tour","done"));
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (r.frame() === page.mainFrame() && !r.url().startsWith("http://127.0.0.1:8842/") && !r.url().startsWith("https://s3.tradingview.com/external-embedding/") && !r.url().startsWith("https://www.tradingview-widget.com/")) external.push(r.url());
    });
    const initialAtlas = page.waitForResponse(r => r.url().includes("/api/atlas?base=USD") && r.ok()).then(r=>r.json());
    await page.goto("http://127.0.0.1:8842/");
    await page.waitForSelector("#detail .rate");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("#detail h2").textContent(), "Brasil");
    assert.equal(await page.locator("#land path").count(), 242);
    assert.equal(await page.locator("#rows tr").count(), 12);
    const media =
      process.env.OEG_SCREENSHOTS ||
      path.join(__dirname, "../data/run/capturas");
    fs.mkdirSync(media, { recursive: true });
    await page.waitForSelector(".comparisonPlot .trace2", { state:"attached" });
    assert.match(await page.locator("#detail").innerText(), /USD\/BRL/);
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(16, 19, 22)",
    );
    // Espaços: o Panorama abre com o pulso do dia e o mapa; o resto fica nos outros espaços.
    assert.equal(await page.locator(".deskHead h1:visible").textContent(), "Panorama");
    assert.ok((await page.locator(".pulseTile").count()) >= 1);
    assert.equal(await page.locator("#ticker").isVisible(), false);
    await page.screenshot({ path: media + "/panorama.png" });
    await page.click("#railToggle");
    assert.equal(
      await page.locator("#railToggle").getAttribute("aria-expanded"),
      "true",
    );
    await page.click("#railToggle");
    await page.click("#expandAtlas");
    assert.ok(await page.evaluate(() => Boolean(document.fullscreenElement)));
    await page.click("#expandAtlas");
    await page.click('button[data-sheet="news"]');
    assert.ok(
      (await page.locator("#localBulletin a[href*='bcb.gov.br']").count()) ===
        1,
    );
    assert.equal(await page.locator('#localBulletin a[href="#agenda"]').count(), 1);
    await page.locator('#pins [data-id="USA"] circle').click();
    assert.equal(
      await page
        .locator("#localBulletin a[href*='federalreserve.gov']")
        .count(),
      1,
    );
    await page.click('button[data-sheet="market"]');
    await page.click('button[data-layer="heat"]');
    assert.equal(await page.locator("#heatTiles button").count(), 9);
    assert.ok(
      (await page
        .locator("#heatTiles .up,#heatTiles .down,#heatTiles .flat")
        .count()) > 0,
    );
    await page.locator("#atlas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: media + "/heatmap.png" });
    assert.equal(await page.locator("#fxBase").inputValue(), "USD");
    assert.match(
      await page.locator("#ticker button").first().innerText(),
      /USD \/ BRL/,
    );
    for (const [key, count, asset] of [
      ["crypto", 6, "BTC"],
      ["us", 9, "MSFT"],
      ["br", 9, "PETR4"],
    ]) {
      await page.click('[data-group="' + key + '"]');
      await page.click('[data-asset="' + asset + '"]');
      assert.equal(
        await page.locator("#heatTiles [data-asset]").count(),
        count,
      );
      assert.match(
        await page.locator("#assetDetail").innerText(),
        /CVM · CDA mensal/,
      );
      assert.match(await page.locator("#assetDetail").innerText(), /USD/);
      const sizing = page.locator(".treeBar select[aria-label=Área]");
      if (key === "us") assert.ok(await sizing.locator('option[value="volume"]').isDisabled());
      if (key === "br") {
        await sizing.selectOption("volume");
        const cell = page.locator('[data-asset="PETR4"]');
        const small = page.locator('[data-asset="SUZB3"]');
        const rect = await cell.boundingBox(), other = await small.boundingBox();
        assert.ok(rect.width * rect.height > other.width * other.height * 3);
        await cell.hover();
        await page.mouse.wheel(0,-260);
        await page.waitForFunction(()=>Number(document.querySelector(".treeView").dataset.zoom)>1.25);
        await page.locator(".treeNav").getByRole("button",{name:"Restaurar enquadramento"}).click();
        await page.getByLabel("Setor",{exact:true}).selectOption("Financeiro");
        assert.equal(await page.locator(".treeCell").count(),3);
        await page.getByLabel("Setor",{exact:true}).selectOption("");
        await cell.click();
      }
      await page.mouse.move(0,0);
      await page.locator("#atlas").screenshot({ path: media + "/heatmap-" + key + ".png" });
    }
    await page.selectOption("#fxBase", "EUR");
    await page.waitForFunction(() =>
      document.querySelector(".assetPrice")?.textContent.includes("EUR"),
    );
    await page.click('[data-group="fx"]');
    await page.waitForFunction(() =>
      document.querySelector("#heatTiles")?.textContent.includes("EUR/BRL"),
    );
    await page.selectOption("#fxBase", "USD");
    await page.waitForFunction(() =>
      document.querySelector("#heatTiles")?.textContent.includes("USD/BRL"),
    );
    await page.click('[data-heat-pick="BRA"]');
    assert.equal(await page.locator("#detail h2").textContent(), "Brasil");
    assert.equal(
      await page.locator("#map").getAttribute("data-layer"),
      "daily",
    );
    await page.click('button[data-layer="coverage"]');
    assert.equal(
      await page.locator("#map").getAttribute("data-layer"),
      "coverage",
    );
    await page.click('button[data-layer="daily"]');
    await page.click("#compareMarket");
    assert.equal(await page.locator("#compareA").inputValue(), "BRL");
    await page.selectOption("#compareB", "JPY");
    await page.selectOption("#compareDays", "7");
    await page.waitForFunction(
      () => document.querySelector(".key2 strong")?.textContent === "USD/JPY",
    );
    await page.locator("#compareResult summary").click();
    assert.ok((await page.locator("#compareResult tbody tr").count()) >= 2);
    await page.locator("#compareResult summary").click();
    await page
      .locator("#comparison")
      .screenshot({ path: media + "/comparador.png" });
    await page.selectOption("#compareB", "BRL");
    await page
      .getByText("Selecione dois pares distintos.", { exact: true })
      .waitFor();
    await page.selectOption("#compareB", "EUR");
    await page.evaluate(() => (location.hash = "#/panorama"));
    await page.locator('#pins [data-id="CAN"] circle').click();
    assert.equal(await page.locator("#detail h2").textContent(), "Canadá");
    const initial = await page.locator("#map").getAttribute("viewBox");
    await page.click("#zin");
    assert.notEqual(
      await page.locator("#map").getAttribute("viewBox"),
      initial,
    );
    await page.locator("#map").focus();
    await page.keyboard.press("ArrowLeft");
    await page.click("#home");
    assert.equal(await page.locator("#map").getAttribute("viewBox"), initial);
    const box = await page.locator("#map").boundingBox();
    await page.mouse.move(box.x + 90, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 130, { steps: 6 });
    await page.mouse.up();
    assert.notEqual(
      await page.locator("#map").getAttribute("viewBox"),
      initial,
    );
    await page.click("#home");
    await page.selectOption("#region", "Europa");
    assert.equal(await page.locator("#rows tr").count(), 4);
    await page.click("#searchOpen");
    await page.fill("#query", "cac 40");
    await page.locator("#results button").first().click();
    assert.equal(await page.locator("#detail h2").textContent(), "França");
    await page.click("#theme");
    await page.click('[data-days="7"]');
    await page.reload();
    await page.waitForSelector("#detail .rate");
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      "light",
    );
    assert.equal(await page.locator("#region").inputValue(), "Europa");
    assert.equal(await page.locator("#compareDays").inputValue(), "7");
    assert.equal(await page.locator("#detail h2").textContent(), "França");
    assert.equal(
      await page.locator('[data-days="7"]').getAttribute("aria-pressed"),
      "true",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: media + "/europa.png" });
    await page.click("#record");
    await page.waitForSelector("#metadata[open]");
    assert.match(await page.locator("#metaBody").innerText(), /SHA-256/);
    await page.locator("#metaBody summary").click();
    assert.ok((await page.locator("#metaBody tbody tr").count()) > 1);
    await page.keyboard.press("Escape");
    await page.keyboard.press("/");
    await page.fill("#query", "Zona do Euro");
    await page.press("#query", "Enter");
    assert.equal(await page.locator("#land .selected").count(), 21);
    await page.keyboard.press("/");
    await page.fill("#query", "Gana");
    await page.press("#query", "Enter");
    assert.match(await page.locator("#detail").innerText(), /Sem cobertura/);
    assert.equal(await page.locator("#detail .rate").count(), 0);
    await page.keyboard.press("/");
    await page.fill("#query", "Ibovespa");
    await page.press("#query", "Enter");
    await page.click("#theme");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: media + "/mobile.png", fullPage: true });
    await page.click("#openEquities");
    await page.click('[data-asset="PETR4"]');
    assert.equal(
      await page.locator("#assetDetail h2").textContent(),
      "Petrobras PN",
    );
    await page.locator("#assetDetail summary").click();
    assert.match(await page.locator("#assetDetail").innerText(), /R\$ 100/);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: media + "/mobile-heatmap.png",
      fullPage: true,
    });
    await page.evaluate(() => (location.hash = "#/panorama"));
    await page.click('[data-layer="daily"]');
    await page.locator("#compareMarket").click();
    assert.equal(await page.locator("#compareA").inputValue(), "BRL");
    await page.route("**/api/atlas?*", async (route) => {
      const simulated = structuredClone(await initialAtlas);
      simulated.source.status = "Fonte indisponível";
      simulated.source.error = "Simulação local de falha";
      simulated.series = {};
      simulated.usd_crosses = {};
      await route.fulfill({ json: simulated });
    });
    await page.goto("http://127.0.0.1:8842/#atlas");
    await page.reload();
    await page
      .getByText("Fonte indisponível", { exact: true })
      .first()
      .waitFor();
    assert.equal(await page.locator("#detail .rate").count(), 0);
    assert.equal(await page.locator("#land .covered").count(), 0);
    await page.click('button[data-layer="heat"]');
    assert.equal(
      await page
        .locator("#heatTiles .up,#heatTiles .down,#heatTiles .flat")
        .count(),
      0,
    );
    assert.match(
      await page.locator("#compareResult").innerText(),
      /Comparação indisponível/,
    );
    assert.equal(await page.locator("#compareResult .trace").count(), 0);
    await page.route("**/api/heatmaps", (route) =>
      route.fulfill({ status: 503, body: "indisponível" }),
    );
    await page.reload();
    await page.click('[data-layer="heat"]');
    await page.click('[data-group="crypto"]');
    await page.getByRole("button", { name: "Tentar novamente" }).waitFor();
    assert.equal(await page.locator("[data-asset]").count(), 0);
    await page.unroute("**/api/heatmaps");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page.locator('[data-asset="BTC"]').waitFor();
    await page.unroute("**/api/atlas?*");
    await page.goto("http://127.0.0.1:8842/?heatmap=us");
    await page.locator('[data-asset="MSFT"]').waitFor();
    await page.selectOption("#fxBase", "EUR");
    await page.waitForFunction(() => document.querySelector(".assetPrice")?.textContent.includes("EUR"));
    await page.reload();
    await page.locator('[data-asset="MSFT"]').waitFor();
    assert.equal(await page.locator("#fxBase").inputValue(), "USD");
    assert.match(await page.locator("#assetDetail .assetPrice").innerText(), /USD/);
    const newsTime = new Date().toISOString();
    await page.route("**/api/noticias", route => route.fulfill({json:{
      items: Array.from({length:54}, (_,i)=>({id:String(i),title:"Publicação "+i,source:"teste",
        impact:i===0?3:1, topic:"economia",time:newsTime,link:"https://example.org/"+i})),
      topics:{economia:"Economia"}, links:{}, sources:[{id:"teste",short:"Fonte de teste",received:newsTime}]
    }}));
    await page.goto("http://127.0.0.1:8842/#noticias");
    await page.reload();
    await page.locator(".nwMore").click();
    assert.equal(await page.locator(".nwList .nwTitle").count(),51);
    await page.locator(".nwMore").click();
    const headlines=await page.locator(".nwList .nwTitle").allTextContents();
    assert.equal(new Set(headlines).size,54);
    assert.equal(headlines.length,54);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      "PASS · mapa, 242 geometrias, 12 mercados, seleção, busca, zoom, teclado, região, bloco, temas, período, recarga, origem, ausência, mobile, heatmap setorial, volume, zoom e paginação de notícias; sem erros JS nem origens inesperadas.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
