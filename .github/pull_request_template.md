Fecha #

## O que muda
<!-- Para quem usa a plataforma, em 2 a 4 itens. -->

## Por quê
<!-- O problema ou a pergunta que esta frente responde. -->

## Arquivos compartilhados tocados
<!-- index.html, app.css, app.js, server/app.py, config/macro.json, README… e o que foi acrescentado em cada um. -->

## Como testar
<!-- Endereço da seção (ex.: http://127.0.0.1:8843/#narrador) e o que conferir. -->

## Checklist
- [ ] Rebase na `main` atual (`git fetch origin && git rebase origin/main`)
- [ ] `python -m unittest discover -s tests`
- [ ] `node tests/risk.mjs && node tests/narrator.mjs && node tests/session-calendar.mjs`
- [ ] `node tests/smoke.cjs http://127.0.0.1:8843`, sem erro no computador e no celular
- [ ] Testes novos para regra ou cálculo novo
- [ ] README, `docs/fontes.md` e tabela de rotas atualizados, se for o caso
- [ ] Sem segredo, caminho local, dado da B3 ou cache no diff
- [ ] Fonte nova com licença registrada (ou não há fonte nova)

## Pendências e decisões
<!-- O que ficou de fora, o que depende do dono, escolhas não óbvias. -->
