# Como trabalhar em paralelo sem atrapalhar ninguém

Guia para a IA (e para a pessoa que a conduz) que vai trabalhar no Observatório junto com outras
frentes. As regras técnicas do projeto estão no [AGENTS.md](AGENTS.md). Aqui está **como
conciliar o trabalho**: dividir as frentes, sincronizar com a `main`, evitar e resolver
conflitos e passar o bastão de uma sessão para a próxima.

O princípio é: **o repositório é o único canal.** As IAs não conversam entre si e não lembram das
sessões anteriores. O que não estiver escrito numa issue, num Pull Request ou num commit, para os
outros não existe.

## 1. Regra de ouro

**Uma frente = uma issue = uma branch = um Pull Request.**

- Pequeno e frequente. Um PR com menos de ~400 linhas alteradas é revisado no mesmo dia. Um de
  2.000 linhas trava todo mundo.
- Um assunto por PR. Achou um bug fora da sua frente? Abra uma issue. Não corrija "de passagem".
- Ninguém commita direto na `main`. Só o dono do repositório faz merge.

## 2. Começo de cada sessão (sempre, nesta ordem)

```bash
git fetch origin --prune
git status                      # nada pendente de outra sessão?
gh issue list --assignee @me    # minhas frentes
gh pr list                      # o que os outros estão mexendo agora
```

1. **Se você já tem uma frente:** leia a issue e o **último comentário de passagem de bastão** no
   PR (seção 8) antes de tocar no código. Depois traga a `main` para a sua branch:
   ```bash
   git switch frente/<nome>
   git rebase origin/main
   ```
2. **Se vai começar uma frente nova:**
   - confira em `gh issue list` e `gh pr list` se ninguém está nela;
   - abra a issue pelo modelo **Frente de trabalho** e assuma: `gh issue edit <n> --add-assignee @me`;
   - crie a branch a partir da `main` atualizada: `git switch -c frente/<nome> origin/main`.
3. **Abra o PR como rascunho logo no primeiro commit**, para os outros verem quais arquivos você
   está tocando: `gh pr create --draft --fill`. Escreva `Fecha #<n>` na descrição.

### Nomes de branch

| Prefixo | Uso | Exemplo |
|---|---|---|
| `frente/` | funcionalidade nova ou seção | `frente/narrador-ia` |
| `correcao/` | erro em algo que já existe | `correcao/fluxo-mes-parcial` |
| `docs/` | só documentação | `docs/guia-colaboracao` |
| `dados/` | fonte nova ou mudança de coleta | `dados/caged` |

Use minúsculas, sem acento e com hífen.

## 3. Durante o trabalho

- **Commits pequenos**, cada um deixando os testes passando. Mensagem em pt-BR: título curto, que
  diz o que muda para quem usa, e corpo com o porquê.
- **Sincronize com a `main` pelo menos uma vez por sessão** e sempre antes de pedir revisão:
  ```bash
  git fetch origin && git rebase origin/main
  git push --force-with-lease     # só na SUA branch
  ```
- **Nunca** use `git push --force` em branch de outra pessoa nem na `main`. Também não reescreva
  histórico que já está na `main`.
- Branch de outra frente: leia à vontade, mas não commite nela. Precisa de algo dela? Espere o
  merge ou combine no PR dela.
- Ao perceber que vai precisar mexer num arquivo que outro PR aberto também mexe (`gh pr diff <n>`),
  avise com um comentário nos dois PRs **antes** de fazer a mudança.

## 4. Arquivos compartilhados: onde os conflitos acontecem

Quase todo PR passa por estes arquivos. Edite **só o seu pedaço**, no lugar indicado. Assim, um
conflito vira "manter as duas linhas" e se resolve em segundos.

| Arquivo | Como mexer |
|---|---|
| `web/index.html` | Sua `<section id="…" data-desk="…">` inteira num bloco só, entre duas seções existentes. Não reindente nem reorganize o resto. |
| `web/app.css` (6.600+ linhas) | Acrescente no **fim do arquivo**, num bloco que começa com `/* Nome da seção */`, usando um prefixo de classe próprio (`.nr…`, `.sp…`). Não altere regras de outras seções. Se precisar, abra uma issue. |
| `web/app.js` | Uma linha de `import` e uma de montagem (`whenShown(...)`), perto das da mesma área. |
| `server/app.py` | Um `elif path == "/api/…"` por rota, com no máximo cinco linhas. A lógica vai num módulo próprio em `server/`. |
| `config/macro.json` | Só acrescente chaves. Não reordene nem renomeie as que existem. |
| `web/desks.js`, `web/finder.js`, `tests/smoke.cjs` | Uma linha cada (o atalho, a entrada da busca, o `id` da seção). |
| `README.md`, `docs/fontes.md`, `docs/camada-macro.md` | Sua seção ou suas linhas de tabela. Não reescreva o texto de outras seções. |
| `server/health.py`, `server/macro.py` | Só acrescente a sua fonte ou o seu job. Mudança de comportamento geral vira um PR próprio. |

**Proibido em PR de frente:**

- reformatar um arquivo inteiro (formatador, troca de aspas, reindentação);
- renomear ou mover arquivos;
- atualizar texto ou estilo de outra seção.

Isso gera conflito em todos os outros PRs abertos. Se for necessário, vira um PR próprio,
combinado antes numa issue.

## 5. Resolver conflitos

Ao rodar `git rebase origin/main`, se houver conflito:

1. **Duas frentes acrescentaram coisas lado a lado** (linhas de lista, seções, blocos de CSS,
   entradas em tabela): mantenha **as duas**, na ordem que faça sentido.
2. **As duas mudaram a mesma lógica:** não escolha sozinho.
   - Interrompa o rebase com `git rebase --abort`.
   - Comente no seu PR e no outro, explicando o conflito.
   - Espere a combinação, ou espere o outro PR entrar e adapte o seu.
3. Depois de resolver, rode **todos** os testes da seção 6 antes de `git rebase --continue` e do push.
4. Nunca resolva um conflito apagando o trabalho de outra pessoa para "fazer passar".

## 6. Antes de pedir revisão

Checklist (o modelo de PR repete isto):

```bash
git fetch origin && git rebase origin/main
python -m unittest discover -s tests
node tests/risk.mjs && node tests/narrator.mjs && node tests/session-calendar.mjs
python observatorio.py --port 8843          # em outro terminal
node tests/smoke.cjs http://127.0.0.1:8843  # computador e celular, sem erro
```

- [ ] Testes novos para a regra ou o cálculo novo, com dados sintéticos (sem rede).
- [ ] README, `docs/fontes.md` e a tabela de rotas atualizados, se for o caso.
- [ ] Nenhum segredo, caminho da sua máquina, dado da B3 ou cache no commit (`git diff origin/main --stat`).
- [ ] Mudou a tela? Descreva no PR o que conferiu no computador e no celular.
- [ ] Tire o PR do rascunho: `gh pr ready`.

## 7. Revisão e merge

- Quem decide o merge é o **dono do repositório**. A IA não faz merge na `main`, mesmo que tenha
  permissão.
- O merge é por **Squash and merge**: um commit por frente na `main`, com o título do PR.
- Pediram mudança? Faça novos commits na mesma branch e responda cada comentário dizendo o que
  mudou. Não abra outro PR.
- Depois do merge, apague a branch e, na próxima sessão, comece pela seção 2.

## 8. Passagem de bastão (fim de cada sessão)

A próxima sessão pode ser outra IA, ou a mesma sem memória. **Toda sessão termina com um
comentário no PR** (ou na issue, se ainda não houver PR), neste formato:

```markdown
### Passagem de bastão: AAAA-MM-DD
**Estado:** em andamento | pronto para revisão | bloqueado
**Feito nesta sessão:** o que mudou, em 2 a 4 itens.
**Próximo passo:** a primeira coisa que a próxima sessão deve fazer, com arquivo e função.
**Bloqueios e dúvidas:** o que depende de decisão do dono ou de outro PR (com o número).
**Decisões tomadas:** escolhas não óbvias e o porquê (limiares, fontes descartadas, formatos).
**Testes:** o que rodou e o resultado.
```

Para publicar: `gh pr comment <n> --body-file passagem.md`. Não deixe trabalho sem commit no fim
da sessão. Se estiver incompleto, faça um commit `WIP: …` na sua branch e conte no comentário.

## 9. Decisões e o que pedir ao humano

**A IA decide sozinha:** a implementação dentro da frente, os nomes internos, a estrutura de testes,
os textos da interface seguindo o estilo existente.

**A IA pergunta ao dono (num comentário na issue ou no PR) antes de:**

- incluir uma fonte de dados nova, ou qualquer coisa com licença incerta;
- mudar uma regra do `AGENTS.md`, comportamento de outra seção, ou o formato de uma rota que
  outra parte usa;
- adicionar dependência, serviço externo, chave de API, login ou cobrança;
- apagar funcionalidade, renomear rotas ou fazer qualquer coisa na `main`.

Uma decisão que muda as regras do projeto entra como PR alterando o `AGENTS.md`, para que todas as
IAs passem a segui-la.

## 10. Resumo de bolso

1. `git fetch`, leia a issue e o último bastão, `git rebase origin/main`.
2. Uma frente, uma branch, um PR em rascunho desde o começo.
3. Nos arquivos compartilhados, só o seu bloco, no fim ou no lugar indicado.
4. Conflito de lista: mantenha os dois. Conflito de lógica: pare e combine.
5. Testes e smoke antes de pedir revisão. O merge é do dono.
6. Termine a sessão com o comentário de passagem de bastão.
