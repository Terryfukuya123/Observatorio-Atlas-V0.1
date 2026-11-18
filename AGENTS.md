# Guia para quem colabora (pessoas e assistentes de IA)

Este arquivo é o ponto de partida para quem vai continuar o Observatório Econômico Global, com ou
sem um assistente de IA (Claude Code, Codex, Cursor, Copilot e afins leem este arquivo
automaticamente). Leia inteiro antes da primeira mudança. O `README.md` descreve cada seção e as
regras de cálculo. O `docs/fontes.md` traz a matriz de fontes e licenças.

## O que é

Uma plataforma local, em português do Brasil, que reúne dados públicos de economia e mercado:
câmbio, juros, inflação, atividade, fluxo de capital, expectativas do Focus, notícias oficiais e um
narrador que lê o que mudou. Cada número mostra a fonte, a data e a licença. A versão atual é de
**validação**: gratuita, sem conta, rodando na máquina de quem usa.

## Rodar

Requisitos: Python 3.11 ou superior. O servidor não tem dependências além da biblioteca padrão.

```bash
git clone https://github.com/Terryfukuya123/Observatorio-Atlas-V0.1.git
cd Observatorio-Atlas-V0.1
python observatorio.py            # http://127.0.0.1:8842  (Ctrl+C encerra)
python observatorio.py --port 8843
```

No Windows também há `scripts/start.ps1` e `scripts/stop.ps1`, que rodam o servidor em segundo
plano na porta 8842. Os dados são coletados na primeira visita e guardados em `data/cache/`, que
não é versionado.

## Verificar antes de cada commit

```bash
python -m unittest discover -s tests
node tests/risk.mjs
node tests/narrator.mjs
node tests/session-calendar.mjs
```

Com o servidor rodando, faça também o roteiro de fumaça. Ele usa o Edge e o pacote
`playwright-core` (instalação no README, seção "Verificar"):

```bash
node tests/smoke.cjs http://127.0.0.1:8842
```

Ele abre os quatro espaços no tamanho de computador e de celular. Falha se houver erro de script,
violação de CSP, erro HTTP, seção vazia ou página mais larga que a tela.

## Estrutura

| Pasta | Papel |
|---|---|
| `observatorio.py` | Ponto de entrada (`server/app.py`) |
| `server/` | API HTTP (só `127.0.0.1`), lojas com cache e cálculos: `macro.py` (coletas do BCB, IBGE, Tesouro dos EUA e outras), `surprises.py`, `inflation.py`, `news.py`, `narrator.py`, `tesouro.py`, `b3.py`, `health.py` |
| `providers/` | Adaptadores de cada fonte: montam a URL e normalizam a resposta |
| `core/` | Cálculos de câmbio com `Decimal` e calendário |
| `config/` | Catálogos: séries do `macro.json`, mercados do `markets.json` |
| `web/` | Página única: `index.html`, `app.css` e um módulo ES por seção, montado em `app.js` |
| `tests/` | `test_*.py` (unittest), `*.mjs` (node), `smoke.cjs` e `browser.cjs` (navegador) |
| `docs/` | Fontes e licenças, contrato da API, notas de cada entrega |
| `data/` | `cache/` e `run/` locais e `b3/` para importação manual, nada disso versionado; `editions/` é a edição inicial dos heatmaps |

Padrões já usados (siga-os):

- **Coleta:** cada série é um job `(chave, url, parser)` no `MacroStore`, com validade por prefixo
  (`TTL` em `server/macro.py`). A coleta roda em segundo plano, guarda a última versão boa e marca
  a falha sem apagar o dado anterior. Toda fonte nova aparece na Saúde das fontes (`server/health.py`).
- **Front:** `cachedFetch` (`web/data.js`) faz uma busca por endereço por minuto. `whenShown` (`web/app.js`)
  só monta a seção quando o espaço dela abre. `read`/`save` (`web/storage.js`) guardam preferências
  em `localStorage` com prefixo `oeg.`, só strings.
- **Espaços:** Panorama, Mercados, Brasil e Global, em `web/desks.js`. Cada `<section>` tem `data-desk`.

## Regras do projeto (não negociáveis)

1. **Português do Brasil** em tudo: interface, documentação, comentários e mensagens de commit.
   Código, nomes de API e termos técnicos ficam como estão.
2. **Python só com a biblioteca padrão.** Nada de `pip install`. No navegador, nada de CDN nem
   framework: módulos ES próprios.
3. **CSP estrita** (`server/app.py`). Não use atributo `style` nem `<style>` novo: use classes e
   `data-*` no `app.css`. Sem `eval`, sem script externo. A única exceção é o widget do TradingView,
   que já existe. O roteiro de fumaça falha em violação de CSP.
4. **Servidor só em loopback** (`127.0.0.1`), com checagem do cabeçalho `Host`.
5. **B3: nunca baixe nem raspe páginas ou arquivos da B3 automaticamente.** Os termos da B3 vedam
   isso. A planilha "Dados de Mercado" entra só por importação manual em `data/b3/`, e a exibição a
   terceiros depende de licença de Market Data.
6. **Toda fonte nova** entra em `docs/fontes.md` com o que é coletado, a frequência, o que fica
   guardado, a licença e o comportamento em falha. Sem licença clara, a fonte não entra: registre
   como bloqueada.
7. **Números com procedência.** Cada valor na tela mostra a fonte e a data. Nada é estimado sem
   dizer como. O narrador e qualquer texto automático só podem usar números que a plataforma já
   tem. Nunca invente valores.
8. **Nesta etapa, nada de login, cadastro, conta ou cobrança.**
9. **Não versione** `data/cache/`, `data/run/`, `data/b3/`, `.env`, chaves, tokens nem caminhos
   da sua máquina.
10. **Não é recomendação de investimento.** Textos que leem o mercado dizem isso.

## Fluxo de trabalho

- Uma **branch por frente** (`narrador-ia`, `fiscal`, `b3-licenca`…). Não commite direto na `main`.
- Commits pequenos, mensagem em pt-BR: título curto e corpo com o que mudou e por quê.
- Abra um Pull Request para a `main`, com o que foi feito, como testar e o resultado dos testes.
- Seção nova, nesta ordem:
  1. o módulo em `web/`, montado em `app.js`;
  2. a `<section>` no `index.html`, com `id` e `data-desk`;
  3. o atalho em `desks.js` e a entrada na busca (`web/finder.js`);
  4. o `id` na lista do `tests/smoke.cjs`;
  5. a descrição no `README.md`;
  6. as fontes em `docs/fontes.md`;
  7. os testes.
- Rota nova na API: o ramo em `server/app.py`, o cálculo num módulo próprio em `server/` com
  testes em `tests/` e uma linha na tabela de rotas de `docs/camada-macro.md`.

## Frentes abertas para continuar

- **Narrador com IA opcional** (ideia inspirada no [OpenJarvis](https://github.com/open-jarvis/OpenJarvis)):
  um "pergunte ao narrador", em que um modelo de linguagem local (Ollama, por exemplo) conversa
  sobre os dados.
  - Desligado por padrão e configurável por quem roda.
  - O modelo só pode reescrever ou responder a partir das frases de `/api/narrador` e dos endpoints
    da API. Números novos não são permitidos.
  - Sem modelo configurado, a plataforma continua igual.
- **Vozes melhores no narrador:** hoje a voz é a do navegador (Web Speech API). Uma voz neural
  local seria opcional, nunca obrigatória.
- **Avisos fora da página:** e-mail ou mensageiro, consumindo `/api/narrador`. Sempre opcional e
  configurado por quem usa.
- **Licenças:** a B3 (Market Data) e as agências privadas de notícias estão bloqueadas até haver
  contrato. Veja `docs/fontes.md`.

Antes de começar uma frente, confira se não há branch ou PR aberto para ela.
