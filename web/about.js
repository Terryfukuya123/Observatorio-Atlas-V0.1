// Sobre o Observatório: o que é a plataforma, como ler os números, de onde vem cada dado
// e em que condições, e o que fica no navegador. As licenças seguem docs/fontes.md.
import { esc } from "./format.js";

// [fonte, o que traz, licença, situação, endereço]. Situação: livre | provisorio | pendente.
export const SOURCES = [
  ["Banco Central do Brasil", "Selic, IPCA, PTAX, Focus, câmbio contratado, balanço de pagamentos e atuações no câmbio", "ODbL 1.0, uso comercial com atribuição", "livre", "https://dadosabertos.bcb.gov.br/"],
  ["IBGE · SIDRA", "Desemprego, atividade, serviços e varejo", "Uso por terceiros com citação do IBGE", "livre", "https://sidra.ibge.gov.br/"],
  ["CVM", "Captação dos fundos e carteiras para os mapas de calor mensais", "ODbL 1.0", "livre", "https://dados.cvm.gov.br/"],
  ["BCE", "Câmbio de referência diário de nove moedas", "Reprodução com crédito e precisão original; dados gratuitos no BCE", "livre", "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"],
  ["Tesouro dos EUA", "Curva de juros diária", "Domínio público", "livre", "https://home.treasury.gov/"],
  ["OCDE", "Indicador antecedente (CLI), inflação e desemprego", "Uso com citação da OCDE", "livre", "https://data-explorer.oecd.org/"],
  ["Eurostat", "Inflação, desemprego e PIB da área do euro", "Reuso com citação (países da UE, EFTA e candidatos)", "livre", "https://ec.europa.eu/eurostat/data/database"],
  ["Banco Mundial", "Indicadores anuais por país", "CC BY 4.0", "livre", "https://datacatalog.worldbank.org/"],
  ["Natural Earth", "Cartografia do mapa-múndi", "Domínio público", "livre", "https://www.naturalearthdata.com/"],
  ["TradingView", "Cotações ao vivo, futuros, ADRs e mapas de calor (widgets)", "Uso provisório na fase gratuita, com atribuição; exige acordo antes de assinatura", "provisorio", "https://www.tradingview.com/policies/"],
  ["B3", "Volume do pregão, participação por investidor e saldo dos estrangeiros (relatório importado à mão)", "Propriedade da B3; exibição a terceiros pendente de licença de Market Data", "pendente", "https://www.b3.com.br/"],
];
const STATUS = { livre: "Liberada", provisorio: "Provisória", pendente: "Licença pendente" };

export function aboutHtml() {
  return (
    '<p class="abLead">O Observatório Econômico Global reúne, numa só tela, os dados públicos que movem câmbio, juros, bolsa e atividade, no Brasil e no mundo, com leituras em português sobre o que eles significam.</p>' +
    '<div class="abDesks">' +
    [
      ["#/panorama", "Panorama", "O essencial do dia: pulso, termômetro de risco, próximos eventos e o mapa por país."],
      ["#/mercados", "Mercados", "Pré e pós-mercado, pregão da B3, bolsas do mundo, mapas de calor e força das moedas."],
      ["#/brasil", "Brasil", "Selic, inflação, expectativas do Focus, fluxo de capital e fundos."],
      ["#/global", "Global", "Ciclo econômico, juros dos EUA, agenda com impacto e notícias oficiais."],
    ]
      .map(([href, name, text]) => '<a href="' + href + '" data-close><b>' + esc(name) + "</b><span>" + esc(text) + "</span></a>")
      .join("") +
    "</div>" +
    "<h3>Como ler os números</h3><ul class=\"abList\">" +
    "<li>Cada número mostra a fonte e a data da observação. Dados oficiais chegam com a defasagem de cada órgão: o câmbio do BCE sai no fim da tarde europeia; o fluxo cambial, cerca de uma semana depois; a B3 publica o volume no dia seguinte e os investidores dois dias depois.</li>" +
    "<li>Variações, médias, sinais e leituras em texto são cálculos do Observatório sobre os dados publicados e vêm identificados como tal.</li>" +
    '<li>O botão de <button type="button" class="linkish" data-health>saúde das fontes</button>, no topo, mostra se cada coleta está em dia.</li>' +
    "<li>O conteúdo é informativo. Não é recomendação de investimento nem oferta de produto financeiro.</li></ul>" +
    "<h3>Fontes e licenças</h3>" +
    '<table class="abSources"><thead><tr><th>Fonte</th><th>O que traz</th><th>Condição de uso</th></tr></thead><tbody>' +
    SOURCES.map(
      ([name, what, license, status, url]) =>
        '<tr><td><a href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(name) + " ↗</a></td><td>" + esc(what) +
        "</td><td>" + esc(license) + ' <mark data-status="' + status + '">' + esc(STATUS[status]) + "</mark></td></tr>",
    ).join("") +
    "</tbody></table>" +
    '<p class="abNote">Bases derivadas de dados sob ODbL seguem a mesma licença. <button type="button" class="linkish" data-go="meta">Detalhes do câmbio do BCE e da metodologia</button></p>' +
    "<h3>Privacidade</h3><ul class=\"abList\">" +
    "<li>Não há cadastro. País escolhido, tema, painel e preferências ficam só neste navegador.</li>" +
    "<li>As seções com cotações ao vivo carregam widgets do TradingView, que registra o endereço da página, o símbolo e o IP de quem as abre.</li></ul>" +
    '<p class="abFoot">Versão de validação, gratuita. <button type="button" class="linkish" data-tour>Refazer o tour de boas-vindas</button></p>'
  );
}

export function about({ dialog, openers }) {
  const body = dialog.querySelector(".abBody");
  function open() {
    if (!body.innerHTML) body.innerHTML = aboutHtml();
    if (!dialog.open) dialog.showModal();
  }
  for (const el of openers) el?.addEventListener("click", open);
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close], [data-health], [data-go], [data-tour]")) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (location.hash === "#sobre") history.replaceState(null, "", location.pathname + location.search);
  });
  const fromHash = () => location.hash === "#sobre" && open();
  window.addEventListener("hashchange", fromHash);
  fromHash();
  return { open };
}
