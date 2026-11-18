// Primeira visita guiada: um balão por passo, apontando o que mais ajuda quem chega.
// Aparece uma vez (preferência "tour" no navegador) e pode ser refeito pela página Sobre.
import { esc } from "./format.js";

export const STEPS = [
  { title: "Bem-vindo ao Observatório", text: "Câmbio, juros, bolsa e atividade do Brasil e do mundo numa só tela, com dados oficiais e leituras em português. São cinco passos rápidos." },
  { target: "#sections", title: "Quatro espaços", text: "Panorama traz o essencial do dia. Mercados, Brasil e Global aprofundam cada assunto." },
  { target: "#searchOpen", title: "Busque qualquer coisa", text: "País, moeda, indicador ou assunto. No computador, aperte / para abrir a busca." },
  { target: ".pulseCustomize", title: "Monte o seu painel", text: "Escolha os indicadores que você acompanha. O painel fica salvo neste navegador." },
  { target: "#health", title: "Dados em dia?", text: "Este botão mostra se cada fonte foi coletada no prazo e quando foi a última atualização." },
  { target: "#sources", title: "De onde vem cada número", text: "Fontes, licenças e como ler os dados ficam em Sobre e fontes. Os botões ? explicam cada termo." },
];

export function tour({ read, save, force = false }) {
  if (!force && read("tour", "") === "done") return null;
  let index = 0;
  let focused = null;
  const box = document.createElement("div");
  box.className = "tour";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "false");
  box.setAttribute("aria-labelledby", "tourTitle");
  document.body.append(box);

  function finish() {
    save("tour", "done");
    focused?.classList.remove("tourFocus");
    box.remove();
    window.removeEventListener("resize", place);
    document.removeEventListener("keydown", keys);
  }

  // Posiciona o balão perto do alvo (abaixo, ou acima se não couber), sem sair da tela.
  function place() {
    const step = STEPS[index];
    const target = step.target && document.querySelector(step.target);
    const visible = target && target.getClientRects().length && target.getBoundingClientRect().width > 0;
    box.dataset.anchored = String(!!visible);
    if (!visible) {
      box.style.left = "";
      box.style.top = "";
      return;
    }
    const r = target.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const gap = 12;
    let top = r.bottom + gap;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
    let left = r.left + r.width / 2 - w / 2;
    // Alvo alto e estreito (menu lateral): o balão vai ao lado.
    if (r.height > r.width * 2 && r.right + gap + w < window.innerWidth) {
      left = r.right + gap;
      top = Math.min(Math.max(8, r.top), window.innerHeight - h - 8);
    }
    box.style.left = Math.min(Math.max(8, left), window.innerWidth - w - 8) + "px";
    box.style.top = top + "px";
  }

  function show() {
    const step = STEPS[index];
    focused?.classList.remove("tourFocus");
    focused = step.target ? document.querySelector(step.target) : null;
    if (focused) {
      focused.classList.add("tourFocus");
      focused.scrollIntoView({ block: "nearest" });
    }
    const last = index === STEPS.length - 1;
    box.innerHTML =
      '<p class="tourStep">' + (index ? index + " de " + (STEPS.length - 1) : "Primeira visita") + "</p>" +
      '<h2 id="tourTitle">' + esc(step.title) + "</h2><p>" + esc(step.text) + "</p>" +
      '<div class="tourActions"><button type="button" class="linkish" data-tour-skip>' + (index ? "Fechar" : "Agora não") + "</button>" +
      (index > 1 ? '<button type="button" data-tour-back>Voltar</button>' : "") +
      '<button type="button" class="tourNext" data-tour-next>' + (index === 0 ? "Começar" : last ? "Concluir" : "Próximo") + "</button></div>";
    requestAnimationFrame(place);
    box.querySelector("[data-tour-next]").focus({ preventScroll: true });
  }

  function keys(event) {
    if (event.key === "Escape") finish();
  }

  box.addEventListener("click", (event) => {
    if (event.target.closest("[data-tour-skip]")) return finish();
    if (event.target.closest("[data-tour-back]")) index = Math.max(0, index - 1);
    else if (event.target.closest("[data-tour-next]")) {
      if (index === STEPS.length - 1) return finish();
      index++;
    } else return;
    show();
  });
  window.addEventListener("resize", place);
  document.addEventListener("keydown", keys);
  show();
  return { finish };
}

// Liga o tour: primeira visita e o botão "Refazer o tour" da página Sobre.
export function tourGuide({ read, save }) {
  let current = null;
  const start = (force) => {
    current?.finish();
    current = tour({ read, save, force });
  };
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-tour]")) {
      location.hash = "#/panorama";
      setTimeout(() => start(true), 300);
    }
  });
  // Só no Panorama e sem ficha ou Sobre abertos: é onde todos os alvos existem.
  if (!location.hash || location.hash === "#/panorama") setTimeout(() => start(false), 1200);
}
