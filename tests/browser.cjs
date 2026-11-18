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
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (!r.url().startsWith("http://127.0.0.1:8842/")) external.push(r.url());
    });
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
    await page.waitForSelector(".comparisonPlot .trace2");
    assert.match(
      await page.locator("#detail").innerText(),
      /USD\/BRL · calculado/,
    );
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(233, 189, 87)",
    );
    await page.screenshot({ path: media + "/panorama.png" });
    await page.click("#compareMarket");
    assert.equal(await page.locator("#compareA").inputValue(), "BRL");
    await page.selectOption("#compareB", "JPY");
    await page.selectOption("#compareDays", "7");
    await page.waitForFunction(
      () => document.querySelector(".key2 strong")?.textContent === "EUR/JPY",
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
    await page.selectOption("#compareB", "USD");
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
    await page.locator("#compareMarket").click();
    assert.equal(await page.locator("#compareA").inputValue(), "BRL");
    await page.route("**/api/atlas", async (route) => {
      const response = await route.fetch();
      const simulated = await response.json();
      simulated.source.status = "Fonte indisponível";
      simulated.source.error = "Simulação local de falha";
      simulated.series = {};
      simulated.usd_crosses = {};
      await route.fulfill({ json: simulated });
    });
    await page.reload();
    await page
      .getByText("Fonte indisponível", { exact: true })
      .first()
      .waitFor();
    assert.equal(await page.locator("#detail .rate").count(), 0);
    assert.equal(await page.locator("#land .covered").count(), 0);
    assert.match(
      await page.locator("#compareResult").innerText(),
      /Comparação indisponível/,
    );
    assert.equal(await page.locator("#compareResult .trace").count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      "PASS · mapa, 242 geometrias, 12 mercados, seleção, busca, zoom, teclado, região, bloco, temas, período, recarga, origem, ausência, mobile, zero requests externos / erros JS.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
