// Particiona o retângulo no eixo mais longo, preservando a razão entre os pesos.
function partition(items, x, y, w, h, place) {
  if (!items.length) return;
  if (items.length === 1) {
    place(items[0], x, y, w, h);
    return;
  }
  const total = items.reduce((s, a) => s + a.weight, 0);
  let n = 1,
    left = items[0].weight;
  while (
    n < items.length - 1 &&
    Math.abs(total / 2 - left - items[n].weight) < Math.abs(total / 2 - left)
  ) {
    left += items[n++].weight;
  }
  const f = left / total;
  if (w >= h) {
    partition(items.slice(0, n), x, y, w * f, h, place);
    partition(items.slice(n), x + w * f, y, w * (1 - f), h, place);
  } else {
    partition(items.slice(0, n), x, y, w, h * f, place);
    partition(items.slice(n), x, y + h * f, w, h * (1 - f), place);
  }
}
const byWeight = (a, b) => b.weight - a.weight;
const pct = (n) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const change = (n) =>
  n == null ? "Sem variação" : (n > 0 ? "+" : "") + pct(n);
function node(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}
function option(select, value, label, disabled = false) {
  const opt = new Option(label, value);
  opt.disabled = disabled;
  select.add(opt);
}
function box(el, x, y, w, h) {
  Object.assign(el.style, {
    left: x + "px",
    top: y + "px",
    width: w + "px",
    height: h + "px",
  });
}
function tool(label, symbol, action) {
  const b = node("button", "", symbol);
  b.type = "button";
  b.title = label;
  b.setAttribute("aria-label", label);
  b.onclick = action;
  return b;
}

export function sectorMap(host) {
  const bar = node("div", "treeBar"),
    metric = node("select"),
    sector = node("select"),
    picker = node("select");
  function control(label, select) {
    const field = node("label", null, label);
    select.setAttribute("aria-label", label);
    field.append(select);
    bar.append(field);
  }
  control("Área", metric);
  control("Setor", sector);
  control("Ativo", picker);
  const view = node("div", "treeView"),
    plane = node("div", "treePlane"),
    nav = node("div", "treeNav");
  const tip = node("div", "treeTip"),
    note = node("div", "treeNote");
  tip.hidden = true;
  view.append(plane, tip);
  bar.append(nav);
  view.tabIndex = 0;
  view.setAttribute(
    "aria-label",
    "Mapa setorial. Use a roda para ampliar, arraste para deslocar ou use os botões de zoom.",
  );
  let model,
    key,
    mode = "position",
    group = "",
    selected,
    scale = 1,
    ox = 0,
    oy = 0,
    drag,
    skipClick = false;
  let selectedBoard = null,
    pickerKey = "";
  const zoomText = node("output");
  function reset() {
    scale = 1;
    ox = oy = 0;
    tip.hidden = true;
    paint();
  }
  function zoom(to, x = view.clientWidth / 2, y = view.clientHeight / 2) {
    to = Math.max(1, Math.min(32, to));
    ox = x - ((x - ox) * to) / scale;
    oy = y - ((y - oy) * to) / scale;
    scale = to;
    tip.hidden = true;
    paint();
  }
  const minus = tool("Reduzir zoom", "−", () => zoom(scale / 1.45));
  const plus = tool("Ampliar zoom", "+", () => zoom(scale * 1.45));
  nav.append(
    minus,
    zoomText,
    plus,
    tool("Restaurar enquadramento", "⟲", reset),
  );
  function choose(symbol) {
    selected = symbol;
    picker.value = symbol;
    model.choose(symbol);
    for (const el of plane.querySelectorAll("[data-asset]"))
      el.setAttribute("aria-pressed", String(el.dataset.asset === symbol));
  }
  function focusSector(s) {
    group = s;
    sector.value = s;
    reset();
    if (
      s &&
      !model.items.some((a) => a.symbol === selected && a.sector === s)
    ) {
      const first = model.items
        .filter((a) => a.sector === s)
        .sort((a, b) => (b[mode] || 0) - (a[mode] || 0))[0];
      if (first) choose(first.symbol);
    }
    view.focus({ preventScroll: true });
  }
  metric.onchange = () => {
    mode = metric.value;
    reset();
  };
  sector.onchange = () => focusSector(sector.value);
  picker.onchange = () => {
    if (picker.value) choose(picker.value);
  };
  view.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.clientHeight : 1);
      zoom(
        scale * Math.exp(-Math.max(-600, Math.min(600, delta)) * 0.002),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    },
    { passive: false },
  );
  view.onkeydown = (e) => {
    if (e.target.closest(".treeNav")) return;
    if (
      [
        "+",
        "=",
        "-",
        "Home",
        "Escape",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === "Home" || e.key === "Escape") focusSector("");
      else if (e.key === "-" || e.key === "+" || e.key === "=")
        zoom(e.key === "-" ? scale / 1.45 : scale * 1.45);
      else {
        ox += { ArrowLeft: 60, ArrowRight: -60 }[e.key] || 0;
        oy += { ArrowUp: 60, ArrowDown: -60 }[e.key] || 0;
        paint();
      }
    }
  };
  view.onpointerdown = (e) => {
    skipClick = false;
    if (e.button || scale === 1 || e.target.closest(".treeNav")) return;
    drag = { x: e.clientX, y: e.clientY, ox, oy, id: e.pointerId };
  };
  view.onpointermove = (e) => {
    if (
      drag &&
      e.buttons === 1 &&
      Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3
    ) {
      view.setPointerCapture(e.pointerId);
      skipClick = true;
      tip.hidden = true;
      ox = drag.ox + e.clientX - drag.x;
      oy = drag.oy + e.clientY - drag.y;
      paint();
      return;
    }
    const cell = e.target.closest("[data-asset]");
    if (!cell || e.pointerType === "touch") {
      tip.hidden = true;
      return;
    }
    tip.textContent = cell.getAttribute("aria-label");
    tip.hidden = false;
    const r = view.getBoundingClientRect();
    tip.style.left =
      Math.max(
        2,
        Math.min(
          view.clientWidth - tip.offsetWidth - 3,
          e.clientX - r.left + 12,
        ),
      ) + "px";
    tip.style.top =
      Math.max(
        2,
        Math.min(
          view.clientHeight - tip.offsetHeight - 3,
          e.clientY - r.top + 14,
        ),
      ) + "px";
  };
  view.onpointerup = view.onpointercancel = () => {
    drag = null;
  };
  view.onpointerleave = () => {
    tip.hidden = true;
    if (!skipClick) drag = null;
  };
  plane.onclick = (e) => {
    if (skipClick) return;
    const cell = e.target.closest("[data-asset]"),
      header = e.target.closest("[data-sector]");
    if (cell) choose(cell.dataset.asset);
    else if (header) focusSector(header.dataset.sector);
  };
  function paint() {
    if (!model || !view.isConnected || !view.clientWidth) return;
    const w = view.clientWidth,
      h = view.clientHeight;
    ox = Math.min(0, Math.max(w * (1 - scale), ox));
    oy = Math.min(0, Math.max(h * (1 - scale), oy));
    view.dataset.zoom = scale.toFixed(2);
    zoomText.textContent =
      scale.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "×";
    minus.disabled = scale === 1;
    plus.disabled = scale === 32;
    const list = model.items.filter((a) => !group || a.sector === group);
    const groups = new Map();
    const basketWeight = model.items.reduce((s, a) => s + (a[mode] || 0), 0);
    const rows = list.filter((a) => a[mode] > 0);
    const keyForPicker = list.map((a) => a.symbol).join(",");
    if (pickerKey !== keyForPicker) {
      pickerKey = keyForPicker;
      picker.replaceChildren(new Option("Selecionar ativo", ""));
      for (const a of list) option(picker, a.symbol, a.symbol + " · " + a.name);
    }
    picker.value = selected;
    for (const a of rows) {
      const s = a.sector || "Sem classificação";
      if (!groups.has(s)) groups.set(s, { name: s, items: [], weight: 0 });
      const g = groups.get(s);
      g.weight += a[mode];
      g.items.push({ asset: a, weight: a[mode] });
    }
    const fragment = document.createDocumentFragment();
    const more = list.length - rows.length;
    const label = mode === "volume" ? "volume declarado" : "valor das posições";
    note.textContent =
      rows.length +
      " de " +
      list.length +
      " ativos com área · Participação no " +
      label +
      " da cesta" +
      (more ? " · Demais ativos disponíveis no seletor" : "");
    if (!group && rows.length >= 4) {
      const leaders = [...rows].sort((a, b) => b[mode] - a[mode]).slice(0, 3);
      const share = pct(
        (100 * leaders.reduce((sum, a) => sum + a[mode], 0)) / basketWeight,
      );
      note.textContent +=
        " · " +
        leaders.map((a) => a.symbol).join(", ") +
        " concentram " +
        share +
        ".";
    }
    if (!rows.length)
      fragment.append(
        node(
          "p",
          "empty",
          mode === "volume"
            ? "Sem volume positivo informado para este recorte."
            : "Posições indisponíveis nesta edição.",
        ),
      );
    partition(
      [...groups.values()].sort(byWeight),
      ox,
      oy,
      w * scale,
      h * scale,
      (g, x, y, sw, sh) => {
        const headerHeight = Math.min(21, sh * 0.19);
        const header = tool("Ampliar setor " + g.name, g.name + " ›", null);
        header.className = "treeSector";
        header.dataset.sector = g.name;
        box(header, x, y, sw, headerHeight);
        fragment.append(header);
        partition(
          g.items.sort(byWeight),
          x,
          y + headerHeight,
          sw,
          sh - headerHeight,
          (part, tx, ty, tw, th) => {
            const a = part.asset,
              n = a.quotes[model.base]?.percent;
            const color =
              n == null
                ? "missing"
                : Math.abs(n) < 0.5
                  ? "neutral"
                  : (n > 0 ? "up" : "down") +
                    (Math.abs(n) >= 8 ? "3" : Math.abs(n) >= 3 ? "2" : "1");
            const btn = node("button", "treeCell " + color);
            btn.type = "button";
            btn.dataset.asset = a.symbol;
            btn.setAttribute("aria-pressed", String(selected === a.symbol));
            const share = pct((100 * part.weight) / basketWeight);
            btn.setAttribute(
              "aria-label",
              a.symbol +
                " · " +
                a.name +
                " · " +
                change(n) +
                " no mês · " +
                share +
                " do " +
                label +
                " da cesta",
            );
            box(btn, tx, ty, tw, th);
            if (tw > Math.max(32, a.symbol.length * 10) && th > 16)
              btn.append(node("strong", "", a.symbol));
            if (tw > 49 && th > 37) btn.append(node("span", "", change(n)));
            if (tw > 125 && th > 73)
              btn.append(node("small", "", a.name + " · " + share));
            fragment.append(btn);
          },
        );
      },
    );
    const focused = plane.contains(document.activeElement)
      ? document.activeElement.dataset.asset
      : null;
    plane.replaceChildren(fragment);
    if (focused)
      plane
        .querySelector('[data-asset="' + focused + '"]')
        ?.focus({ preventScroll: true });
  }
  new ResizeObserver(paint).observe(view);
  return function show(next) {
    model = next;
    selected = next.selected;
    if (key !== next.group || selectedBoard !== next.items) {
      if (key !== next.group) {
        mode = "position";
        group = "";
        scale = 1;
        ox = oy = 0;
      }
      key = next.group;
      selectedBoard = next.items;
      metric.replaceChildren();
      option(metric, "position", "Posições dos fundos");
      option(
        metric,
        "volume",
        next.items.some((a) => a.volume > 0)
          ? "Volume dos fundos"
          : "Volume indisponível",
        !next.items.some((a) => a.volume > 0),
      );
      if (!next.items.some((a) => a.volume > 0)) mode = "position";
      metric.value = mode;
      sector.replaceChildren(new Option("Todos os setores", ""));
      for (const s of [
        ...new Set(next.items.map((a) => a.sector || "Sem classificação")),
      ].sort())
        option(sector, s, s);
      if (![...sector.options].some((o) => o.value === group)) group = "";
      sector.value = group;
    }
    if (!view.isConnected) host.replaceChildren(bar, view, note);
    paint();
  };
}
