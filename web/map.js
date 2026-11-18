const ns = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}) {
  const el = document.createElementNS(ns, tag);
  for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
  return el;
}
const euro = new Set(
  "AUT BEL BGR HRV CYP EST FIN FRA DEU GRC IRL ITA LVA LTU LUX MLT NLD PRT SVK SVN ESP".split(
    " ",
  ),
);
const views = {
  "": [0, 0, 1000, 435],
  Américas: [65, 23, 500, 378],
  Europa: [429, 40, 223, 130],
  "Ásia-Pacífico": [532, 32, 468, 327],
  África: [410, 123, 265, 210],
  Antártida: [80, 388, 840, 91],
};
function project(lon, lat) {
  return [
    500 + 2.68 * lon * Math.cos((lat * 0.53 * Math.PI) / 180),
    231 - lat * 2.62,
  ];
}
export function makeMap(geography, onPick) {
  const map = document.querySelector("#map");
  const land = document.querySelector("#land");
  const pins = document.querySelector("#pins");
  const grid = document.querySelector("#grid");
  let view = views[""].slice(),
    region = "",
    start,
    dragged = false;
  function sizeMarkers() {
    const scale = map.getScreenCTM()?.a || 1;
    for (const marker of pins.children) {
      marker.setAttribute(
        "transform",
        "translate(" +
          marker.dataset.x +
          " " +
          marker.dataset.y +
          ") scale(" +
          1 / scale +
          ")",
      );
    }
  }
  new ResizeObserver(sizeMarkers).observe(map);
  function setView(next) {
    view = next;
    view[0] = Math.max(
      -view[2] * 0.35,
      Math.min(1000 - view[2] * 0.65, view[0]),
    );
    view[1] = Math.max(
      -view[3] * 0.45,
      Math.min(480 - view[3] * 0.55, view[1]),
    );
    map.setAttribute("viewBox", view.join(" "));
    map.dataset.close = view[2] < 600 ? "yes" : "no";
    sizeMarkers();
  }
  function zoom(factor, anchor) {
    const w = Math.min(1100, Math.max(65, view[2] * factor));
    const ratio = w / view[2],
      h = view[3] * ratio;
    const [cx, cy] = anchor || [view[0] + view[2] / 2, view[1] + view[3] / 2];
    setView([cx - (cx - view[0]) * ratio, cy - (cy - view[1]) * ratio, w, h]);
  }
  function position(e) {
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(
      map.getScreenCTM().inverse(),
    );
  }
  function gridLine(coords) {
    grid.append(
      svg("path", { d: "M" + coords.map((p) => p.join(",")).join("L") }),
    );
  }
  for (let lon = -180; lon <= 180; lon += 30)
    gridLine(Array.from({ length: 37 }, (_, i) => project(lon, i * 5 - 90)));
  for (let lat = -75; lat <= 75; lat += 15)
    gridLine([project(-180, lat), project(180, lat)]);
  for (const [name, lon, lat] of [
    ["Pacífico", -131, -15],
    ["Atlântico", -31, 19],
    ["Índico", 75, -24],
  ]) {
    const [x, y] = project(lon, lat);
    const label = svg("text", {
      x,
      y,
      class: "oceanLabel",
      "text-anchor": "middle",
    });
    label.textContent = name;
    grid.append(label);
  }
  for (const g of geography) {
    const path = svg("path", {
      d: g.d,
      class: "land",
      "data-id": g.id,
      "fill-rule": "evenodd",
    });
    const title = svg("title");
    title.textContent = g.name;
    path.append(title);
    land.append(path);
  }
  // Pin the immediate viewport only after a drag starts, preserving simple country clicks.
  map.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragged = false;
    start = [e.clientX, e.clientY, ...view];
  });
  map.addEventListener("pointermove", (e) => {
    if (!start || !e.buttons) return;
    const dx = e.clientX - start[0],
      dy = e.clientY - start[1];
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true;
    map.setPointerCapture(e.pointerId);
    const scale = map.getScreenCTM().a;
    setView([start[2] - dx / scale, start[3] - dy / scale, start[4], start[5]]);
  });
  for (const type of ["pointerup", "pointercancel"])
    map.addEventListener(type, () => {
      start = null;
    });
  map.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id && !dragged) onPick(id);
  });
  map.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const p = position(e);
      zoom(e.deltaY > 0 ? 1.13 : 1 / 1.13, [p.x, p.y]);
    },
    { passive: false },
  );
  const home = () => setView((views[region] || views[""]).slice());
  map.addEventListener("keydown", (e) => {
    const steps = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (steps[e.key]) {
      e.preventDefault();
      const [x, y] = steps[e.key];
      setView([
        view[0] + x * view[2] * 0.1,
        view[1] + y * view[3] * 0.1,
        ...view.slice(2),
      ]);
    } else if (["+", "=", "-", "Home"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Home") home();
      else zoom(e.key === "-" ? 1.25 : 0.8);
    }
  });
  document.querySelector("#zin").onclick = () => zoom(0.8);
  document.querySelector("#zout").onclick = () => zoom(1.25);
  document.querySelector("#home").onclick = home;
  return {
    region(name) {
      region = name;
      home();
    },
    draw(id, available) {
      pins.replaceChildren();
      for (const path of land.children) {
        const code = path.dataset.id;
        path.classList.toggle("covered", available.has(code));
        path.classList.toggle(
          "selected",
          code === id || (id === "EMU" && euro.has(code)),
        );
      }
      for (const g of geography) {
        const selected = g.id === id;
        if (!selected && !available.has(g.id)) continue;
        const [cx, cy] = g.point;
        const group = svg("g", { "data-id": g.id, "data-x": cx, "data-y": cy });
        const title = svg("title");
        title.textContent = g.name;
        group.append(title);
        if (selected) group.append(svg("circle", { r: 11, class: "pinHalo" }));
        group.append(
          svg("circle", {
            r: selected ? 4.5 : 3,
            class: selected ? "pin on" : "pin",
          }),
        );
        if (
          selected ||
          ["USA", "CHN", "AUS", "IND", "JPN", "GBR"].includes(g.id)
        ) {
          const label = svg("text", {
            x: 8,
            y: 3,
            class: selected ? "pinLabel" : "pinLabel secondary",
          });
          label.textContent = selected ? g.name : g.id;
          group.append(label);
        }
        pins.append(group);
      }
      sizeMarkers();
    },
  };
}
