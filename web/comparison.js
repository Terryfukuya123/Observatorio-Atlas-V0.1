import { svg } from "./map.js";

export function comparison({ read, save, fmt, timestamp }) {
  const a = document.querySelector("#compareA"),
    b = document.querySelector("#compareB");
  const days = document.querySelector("#compareDays"),
    output = document.querySelector("#compareResult");
  const numeric = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signed = new Intl.NumberFormat("pt-BR", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let requestNumber = 0;
  days.value = ["7", "30", "90"].includes(read("compareDays", "30"))
    ? read("compareDays", "30")
    : "30";

  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function chart(points) {
    const graph = svg("svg", {
      viewBox: "0 0 820 150",
      preserveAspectRatio: "none",
      role: "img",
      "aria-label":
        "Dois pares cambiais com base 100 na primeira data comum. Valores na tabela a seguir.",
    });
    const values = points.flatMap((p) => p.slice(1));
    const low = Math.min(...values),
      high = Math.max(...values);
    const range = high - low || 1;
    const plotY = (v) => (high === low ? 75 : 12 + ((high - v) / range) * 126);
    for (const v of new Set([low, 100, high])) {
      const y = plotY(v);
      graph.append(
        svg("path", {
          d: "M0 " + y + "H820",
          class: v === 100 ? "baseLine" : "guideLine",
        }),
      );
    }
    const times = points.map((p) => Date.parse(p[0] + "T00:00:00Z"));
    for (const index of [1, 2]) {
      const path = points
        .map(
          (p, i) =>
            ((times[i] - times[0]) / (times.at(-1) - times[0])) * 818 +
            1 +
            "," +
            plotY(p[index]),
        )
        .join("L");
      graph.append(
        svg("path", { d: "M" + path, class: "trace trace" + index }),
      );
    }
    const container = element("div", undefined, "comparisonPlot");
    const axis = element("div", undefined, "plotAxis");
    for (const v of new Set([high, low]))
      axis.append(element("span", numeric.format(v)));
    container.append(graph, axis);
    return container;
  }
  function display(data) {
    if (!data.points.length) {
      output.textContent = data.message + " · " + data.status;
      return;
    }
    const summary = element("div", undefined, "compareSummary");
    for (const [i, pair] of data.pairs.entries()) {
      const row = element("span", undefined, "compareKey key" + (i + 1));
      row.append(
        element("strong", pair),
        element("span", signed.format(data.changes[i]) + "%"),
      );
      summary.append(row);
    }
    const caption = element(
      "p",
      fmt(data.from) +
        " — " +
        fmt(data.to) +
        " · " +
        data.points.length +
        " datas comuns · " +
        data.source +
        " · " +
        data.status,
      "comparisonCaption",
    );
    const details = element("details"),
      table = element("table"),
      head = table.createTHead().insertRow();
    details.append(element("summary", "Dados e método"));
    details.append(
      element(
        "p",
        "O Observatório divide cada taxa pela sua primeira taxa comum na janela e multiplica por 100. Valores acima de 100 indicam que um euro compra mais unidades da moeda de cotação. As linhas ligam apenas as datas presentes nas duas séries.",
      ),
    );
    details.append(
      element(
        "p",
        "Coleta do BCE: " +
          timestamp(data.received) +
          " · SHA-256: " +
          data.snapshot,
      ),
    );
    for (const label of ["Data", ...data.pairs])
      head.append(element("th", label));
    const body = table.createTBody();
    for (const [day, left, right] of [...data.points].reverse()) {
      const row = body.insertRow();
      for (const text of [
        fmt(day),
        numeric.format(left),
        numeric.format(right),
      ])
        row.insertCell().textContent = text;
    }
    details.append(table);
    output.replaceChildren(summary, chart(data.points), caption, details);
  }
  async function update() {
    const version = ++requestNumber;
    output.textContent = "Carregando comparação…";
    if (!a.value || !b.value) {
      output.textContent =
        "Comparação indisponível. A fonte precisa fornecer duas séries.";
      return;
    }
    if (a.value === b.value) {
      output.textContent = "Selecione dois pares distintos.";
      return;
    }
    const params = new URLSearchParams({
      a: a.value,
      b: b.value,
      dias: days.value,
    });
    try {
      const response = await fetch("/api/comparacao?" + params);
      if (!response.ok) throw Error();
      const data = await response.json();
      if (version === requestNumber) display(data);
    } catch {
      if (version === requestNumber)
        output.textContent =
          "Não foi possível carregar a comparação da API local.";
    }
  }
  for (const [el, key] of [
    [a, "compareA"],
    [b, "compareB"],
    [days, "compareDays"],
  ]) {
    el.onchange = () => {
      save(key, el.value);
      update();
    };
  }
  return {
    refresh(series) {
      const codes = Object.keys(series).sort();
      for (const [select, key, fallback] of [
        [a, "compareA", "BRL"],
        [b, "compareB", "USD"],
      ]) {
        const wanted = read(key, fallback);
        select.replaceChildren(
          ...codes.map((code) => new Option("EUR/" + code, code)),
        );
        if (codes.includes(wanted)) select.value = wanted;
        else if (select === b && codes.length > 1)
          select.value = codes.find((c) => c !== a.value);
        select.disabled = !codes.length;
      }
      update();
    },
    pick(code) {
      if (![...a.options].some((o) => o.value === code)) return;
      const previous = a.value;
      a.value = code;
      save("compareA", code);
      if (b.value === code) {
        b.value =
          previous !== code
            ? previous
            : [...b.options].find((o) => o.value !== code)?.value || code;
        save("compareB", b.value);
      }
      update();
      if (location.hash !== "#comparison") location.hash = "comparison";
      document.querySelector("#comparison").scrollIntoView({ block: "start" });
      b.focus({ preventScroll: true });
    },
  };
}
