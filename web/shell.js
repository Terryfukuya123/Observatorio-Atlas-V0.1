// Moldura da página: ícones, tema claro/escuro e a navegação lateral recolhível.
const $ = (s) => document.querySelector(s);

export function shell({ read, save }) {
  const icons = {
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 8h5v5H6zM14 8h4m-4 4h4M6 16h12"/>',
    calendar:
      '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 3v5m10-5v5M3 11h18m-14 4h3m3 0h3"/>',
    rail: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-11 3 3-3 3"/>',
    chart: '<path d="M3 3v17h18M5 15l5-6 4 3 6-8"/>',
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    layers: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.5" ry="9"/><path d="M3 12h18"/>',
    fit: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    flow: '<path d="M4 8h14l-3-3m3 3-3 3M20 16H6l3-3m-3 3 3 3"/>',
    grid: '<rect x="3" y="3" width="8" height="11" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="16" width="8" height="5" rx="1"/>',
  };
  $("html").dataset.theme = read("theme", "dark");
  for (const i of document.querySelectorAll("[data-icon]"))
    i.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' +
      icons[i.dataset.icon] +
      "</svg>";
  $("#theme").onclick = () => {
    const t = $("html").dataset.theme === "light" ? "dark" : "light";
    $("html").dataset.theme = t;
    save("theme", t);
  };
  function setRail(expanded) {
    document.documentElement.dataset.rail = expanded ? "wide" : "compact";
    const label = expanded ? "Recolher navegação" : "Expandir navegação";
    $("#railToggle").setAttribute("aria-expanded", String(expanded));
    $("#railToggle").setAttribute("aria-label", label);
    $("#railToggle").title = label;
  }
  setRail(read("rail", "compact") === "wide");
  $("#railToggle").onclick = () => {
    const expanded = document.documentElement.dataset.rail !== "wide";
    setRail(expanded);
    save("rail", expanded ? "wide" : "compact");
  };
}
