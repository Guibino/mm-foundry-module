# CLAUDE.md — Contexto do projeto (Manual dos Monstros 2024 → módulo FoundryVTT PT-BR)

Este arquivo orienta o Claude Code a continuar o trabalho. Leia por completo antes de agir.

## Objetivo final
Um **módulo FoundryVTT (sistema dnd5e)** com um **Compêndio de Atores** contendo
**todas as criaturas do Monster Manual 2024** em **português brasileiro**,
organizadas por tipo de criatura, **com tokens e retratos**, no mesmo padrão de
organização do projeto de referência: https://github.com/dnd-pt-br/livro-jogador
(embute a tradução direto nos packs; NÃO usa Babele).

"Pronto" = ao instalar o módulo no Foundry, o compêndio "Monstros (MM 2024)"
mostra ~495 criaturas em pastas por tipo, cada uma com atributos/CA/PV/ND/ações
estruturados, nome em PT-BR e token na ficha.

## Estado atual (já funciona)
- **495 criaturas** geradas como Atores `npc` do dnd5e, em **15 pastas por tipo**.
- Tradução de terminologia por glossário PT-BR (`data/glossary/pt-BR.json`).
- **~490/495 tokens** e ~300 retratos baixados do 5e.tools e vinculados.
- Pack compilado em `module/packs/monsters` (LevelDB) via foundryvtt-cli.
- Repositório contém **apenas código** (o conteúdo do livro e as imagens são
  gerados/baixados localmente e ficam gitignored).

## Como o pipeline funciona (scripts em package.json)
Fonte primária = o PDF "AI Upscaled" do usuário (fica um nível acima da pasta):
`npm run all` = extract (PyMuPDF) → index → parse → reconcile → translate →
normalize → build:pack → report.
- `extract` usa `src/extract/extract_pdf.py` (PyMuPDF) por causa de SIGBUS do pdfjs.
- `parse` (`src/parse/parser.ts`) ancora na GRADE DE ATRIBUTOS (STR/DEX/CON +
  INT/WIS/CHA) — assinatura única de cada stat block.
- `reconcile` (`src/parse/reconcile.ts`) casa cada monstro com o INDEX OF STAT
  BLOCKS (páginas 5-7) e adota o nome canônico.
- `normalize` (`src/normalize/`) gera Atores dnd5e + pastas por tipo (`folders.ts`).
- `images` (`src/images/index.ts`) baixa token+retrato do 5e.tools (uso local).
- `relink` = normalize + build:pack + report (revincula imagens sem re-parsear PDF).

Fonte alternativa (mais fiel, sem OCR): `src/source-5etools/` converte o bestiário
XMM do 5e.tools. PORÉM o endpoint de DADOS do 5e.tools retorna **403** (bloqueado);
só o endpoint de IMAGENS funciona. Não tente burlar o 403.

## Tarefas que faltam (prioridade)
1. **Últimos ~5 tokens**: ver `module/assets/faltantes.json`. Casos: "APPENDIX A I
   AN Il MA" (entrada bugada de OCR — remover do resultado), "Rug of Smothering"
   (nome de arquivo do 5e.tools incerto). Ajustar `NAME_OVERRIDES` em
   `src/images/index.ts` ou descartar as entradas inválidas no parser.
2. **~10 nomes de OCR difíceis** (fusões de duas colunas do Apêndice A, ex.:
   "Salamander Modron Quadrone", "APPENDIX A I AN Il MA"). Ver `npm run report`
   (`data/intermediate/quality-report.json`) e a lista de não-casados do reconcile.
3. **Activities nativas do dnd5e**: hoje as ações são Items `feat` com descrição +
   ativação + usos/recarga. Evoluir para `system.activities` (ataque com to-hit e
   dano; save com CD) em `src/normalize/dnd5e.ts` — os dados de mecânica já estão
   em `flags.mm2024.mechanics` de cada item. Testar importando no Foundry v13.
4. Rodar `npm test` e `npm run report` ao final; garantir que o pack compila.

## Regras importantes
- **Não** comitar conteúdo do Monster Manual nem imagens da WotC (respeitar
  `.gitignore`). O repositório é só código/scripts.
- **Não** contornar o 403 do 5e.tools (dados). O download de imagens é local.
- Rodar de um caminho SEM espaços/`&` (Windows quebra npm nesses caminhos).
- Após mudanças, `git add -A && git commit && git push` (remoto: origin/main).

## Validação de "pronto"
- `npm run all` (ou `npm run regen` se o PDF já foi extraído) sem erros.
- `npm run images && npm run relink` — tokens vinculados.
- Instalar `module/` no Foundry como `mm2024-pt-br` e conferir o compêndio.
