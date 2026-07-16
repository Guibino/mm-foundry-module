# Manual dos Monstros 2024 — Módulo FoundryVTT (PT-BR)

Pipeline em **TypeScript/Node** que converte o PDF do *Monster Manual 2024*
(fornecido por você, localmente) em um **módulo FoundryVTT** para o sistema
**dnd5e**, com os monstros como **Actors totalmente estruturados** e
terminologia traduzida para **português brasileiro**.

> ⚠️ **Direitos autorais.** Este repositório contém **apenas código e scripts**.
> Ele **não** inclui o texto do Monster Manual nem imagens da Wizards of the
> Coast. Todo o conteúdo é extraído do **seu** PDF, no **seu** ambiente, durante
> a execução. Os artefatos gerados (`data/`, `module/packs/`, `module/assets/`)
> são ignorados pelo Git (`.gitignore`) e destinam-se a uso pessoal.

---

## Requisitos

- Node.js ≥ 20 (testado em v22)
- Python 3 com `PyMuPDF` (`pip install PyMuPDF --break-system-packages`) — usado
  **apenas** na extração de texto do PDF (backend rápido e robusto)
- Foundry VTT v13–v14 + sistema **dnd5e** ≥ 4.0

## Instalação das dependências

```bash
npm install
```

## Uso rápido (gerar tudo a partir do PDF)

Coloque o PDF ao lado da pasta do projeto (ou aponte com a variável `MM_PDF`) e:

```bash
MM_PDF="/caminho/4. MM (2024) - AI Upscaled + HQ [5e].pdf" npm run all
```

Isso executa, em ordem: `extract → parse → translate → normalize → build:pack →
report`. Ao final, o Compendium fica em `module/packs/monsters` (LevelDB).

> Use o PDF **"AI Upscaled + HQ"**: ele tem texto extraível. O PDF "Scanned" é
> imagem pura e produz OCR corrompido, inviável de parsear.

## Instalar o módulo no Foundry

1. Copie a pasta `module/` para os `Data/modules/` do seu Foundry, renomeando-a
   para `mm2024-pt-br` (o `id` do `module.json`).
2. Inicie o Foundry, ative o módulo em um mundo com o sistema **dnd5e**.
3. Abra o Compendium **"Monstros (MM 2024 PT-BR)"** e arraste os atores para
   suas cenas.

## Imagens (opcional, uso local)

As imagens são arte da WotC (via 5e.tools). O download é **local e opcional**:

```bash
npm run images         # baixa retratos/tokens para module/assets/ (gitignored)
npm run regen          # re-normaliza e recompila, vinculando as imagens
```

---

## Arquitetura

```
mm-foundry-module/
├─ src/
│  ├─ config.ts              # caminhos e ID do módulo
│  ├─ extract/               # 1. PDF → texto limpo (pdfplumber/PyMuPDF via Python)
│  │  ├─ extract_pdf.py      #    backend de extração (coordenadas + colunas)
│  │  ├─ clean.ts            #    correção de artefatos de OCR
│  │  └─ index.ts
│  ├─ parse/                 # 2/3. stat blocks → JSON intermediário (Zod)
│  │  ├─ parser.ts           #    localização de blocos + parse de campos
│  │  └─ schema.ts           #    schema neutro do monstro
│  ├─ translate/             # 4. glossário PT-BR determinístico
│  │  ├─ glossary.ts
│  │  └─ index.ts
│  ├─ normalize/             # 6. JSON → Actor npc do dnd5e (+ Items)
│  │  ├─ dnd5e.ts            #    mapeamento para o schema do sistema
│  │  └─ index.ts
│  ├─ images/                # 5. download de retrato/token (local)
│  └─ build/
│     ├─ pack.ts             # 7. compila o Compendium (foundryvtt-cli)
│     └─ report.ts           # 9. relatório de qualidade
├─ data/
│  ├─ glossary/pt-BR.json    # terminologia oficial (única por termo)
│  ├─ raw/                   # texto extraído (gitignored)
│  └─ intermediate/          # monsters.en/pt.json, quality-report.json (gitignored)
├─ module/                   # o módulo Foundry (module.json, packs/, lang/, assets/)
├─ tests/run.ts              # validação (schema, invariantes, normalização)
└─ package.json
```

### Fluxo de processamento

1. **Extração** — `extract_pdf.py` usa coordenadas por palavra para separar as
   duas colunas da página, descartar o texto vertical de margem e reconstruir a
   ordem de leitura. `clean.ts` corrige OCR sistemático (`ldl0→1d10`, `+O→+0`,
   `E1Jil→Evil` etc.).
2. **Parser** — localiza cada stat block pela âncora `AC … Initiative` (com
   matching tolerante a espaços de OCR), sobe até o nome, e extrai cabeçalho e
   seções (`TRAITS/ACTIONS/BONUS ACTIONS/REACTIONS/LEGENDARY/MYTHIC`). Atributos
   são lidos **posicionalmente** (robusto a rótulos quebrados como `IN T`, `Wi s`).
3. **Tradução** — substituição determinística de termos/frases oficiais do
   glossário (tradução **única por termo**), garantindo consistência com o
   Livro do Jogador 2024 / projeto `dnd-pt-br/livro-jogador`.
4. **Normalização** — cada monstro vira um Actor `npc` do dnd5e com atributos,
   saves (proficiência inferida), perícias (multiplicador inferido), CA/PV/
   deslocamentos/sentidos, tipo/tamanho/tendência/ND/XP e imunidades mapeadas
   para as chaves do sistema. Cada habilidade/ação vira um **Item `feat`** com
   descrição, tipo de ativação e **usos/recarga** nativos.
5. **Build** — `foundryvtt-cli` compila os JSON em um pack **LevelDB**.

### Tecnologias e dependências

- **TypeScript + tsx** (execução), **Zod** (validação do JSON intermediário)
- **PyMuPDF** (extração de texto — único ponto em Python, por robustez)
- **@foundryvtt/foundryvtt-cli** (compilação do Compendium)

---

## Fonte alternativa: 5e.tools (recomendada para máxima fidelidade)

Além do PDF, o projeto inclui um **conversor da fonte estruturada do 5e.tools**
(dados sem OCR — muito mais fiéis). Use a fonte **XMM** (Monster Manual
2024/2025). Isso roda no **seu** ambiente; os dados são da Wizards of the Coast
e **não** vão para o repositório (ficam em `data/`, gitignored).

```bash
npm run fetch:5e     # baixa data/raw/5etools-xmm.json (uso local/pessoal)
npm run build:5e     # converte -> traduz -> normaliza -> compila o pack -> relatório
```

O conversor (`src/source-5etools/`) mapeia todos os campos (CA, PV, atributos,
saves, perícias, sentidos, imunidades, ND, traits, ações, reações, lendárias,
míticas, conjuração) e renderiza as marcações `{@atk}`, `{@hit}`, `{@damage}`,
`{@dc}`, `{@condition}`, etc. A terminologia é traduzida pelo mesmo glossário
PT-BR. Um teste com criatura sintética valida o mapeamento: `npm test`.

> Observação: eu (assistente) não redistribuo a base do 5e.tools — o download e
> a geração acontecem na sua máquina, sob sua responsabilidade e os termos do site.

## Regenerar a partir de outro PDF

```bash
MM_PDF="/caminho/outro-mm.pdf" npm run all
```

Cada etapa também roda isolada: `npm run extract`, `npm run parse`,
`npm run translate`, `npm run normalize`, `npm run build:pack`, `npm run report`.
Se você já extraiu em blocos, `npm run extract:merge` limpa um
`data/raw/pages.merged.json` existente.

---

## Verificação de cobertura (contra o índice do livro)

O pipeline extrai o **INDEX OF STAT BLOCKS** (páginas 5–7 do PDF) como fonte de
verdade dos nomes e faz uma etapa de **reconciliação** (`npm run reconcile`):
casa cada stat block parseado com a entrada do índice por nome + página e adota
o nome canônico. Resultado da última execução:

- **Índice do livro:** 495 entradas (o livro anuncia "500+", contando variações).
- **Stat blocks gerados:** 495 atores (todos com atributos, CA, PV, ND, etc.).
- **Nomes verificados contra o índice:** ~484 casados automaticamente + correções
  manuais de OCR; ~10 monstros em páginas densas do Apêndice A ou com fusão de
  colunas ficam com nome aproximado (sinalizados no relatório).

Rode `npm run report` para a lista detalhada em `data/intermediate/quality-report.json`.

## Qualidade e limitações conhecidas

Rode `npm run report` para ver `data/intermediate/quality-report.json`.

- **Cobertura.** O parser reconhece a maioria dos stat blocks com cabeçalho
  confiável (CA, PV, atributos, saves, perícias, sentidos, ND, imunidades). Nem
  todos os ~500 blocos do livro são capturados nesta primeira versão; blocos
  adjacentes a muito texto de ambientação podem ser perdidos ou imperfeitos.
- **Vazamento entre colunas.** Por causa do layout de duas colunas, o texto de
  **ações/traits** de alguns monstros pode capturar trechos de blocos vizinhos.
  Os dados de **cabeçalho** são de alta confiança; **ações** podem exigir revisão.
  O relatório sinaliza monstros com "ações em excesso".
- **Scores por OCR.** ~7% dos monstros têm algum atributo com erro de OCR
  (ex.: `70` no lugar de `10`). São sinalizados; corrija no ator após importar.
- **Tradução.** A terminologia mecânica é traduzida de forma consistente
  (condições, dano, sentidos, frases de stat block). A **prosa longa** de
  ambientação recebe apenas tradução de termos — não é uma tradução literária.
  Um passo de MT/LLM pode ser plugado em `translate/` para prosa fluente.
- **Magias.** A conjuração é representada como uma feature listando as magias e
  o CD. Itens `Spell` vinculados exigiriam um compêndio SRD de magias.
- **Ações como activities.** Ataques/resistências detectados ficam em
  `flags.mm2024.mechanics` para futura conversão em `activities` completas
  (rolagem automática). Nesta versão, as ações são features com ativação/usos.

## Créditos e atribuição

- **Traduções de descrições (PT-BR):** parte das descrições de ações/traços usa
  as traduções do **[Pocket DM](https://pocketdm.com.br/monstros)**, disponíveis
  sob **CC-BY-4.0**. Usadas apenas quando a assinatura mecânica (dados, CD, bônus
  de acerto e alcances) confere com o stat block 2024 deste módulo.
- **Dados estruturados e imagens de referência:** [5e.tools](https://5e.tools).

## Licença

Código sob MIT (ver `LICENSE` se adicionado). O conteúdo do Monster Manual e as
imagens são © Wizards of the Coast e **não** fazem parte deste repositório.
