# Matrix-Sim

[![CI](https://github.com/kaycke1337/matrix-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/kaycke1337/matrix-sim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)

Autonomous 3D civilization simulation running in the browser. Matrix-Sim models
agents with needs, online learning, social memory, institutions, elections,
transport, housing, labor, and a local SQLite WASM save.

> Documento de visão e arquitetura: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

## Highlights

- Deterministic TypeScript simulation core, independent from rendering.
- Three.js renderer with instanced agents and vehicles.
- Mini neural policy per agent (MLP + REINFORCE) with personality and emotions.
- Persistent SQLite WASM snapshots with OPFS/IndexedDB fallback.
- Civil systems: housing, families, stores, jobs, wages, supply chain, local chat,
  elections, public budget, taxes, welfare, transit subsidy, and approval.
- Headless Vitest coverage for simulation, persistence, politics, labor, and city systems.

## Status

- ✅ **Fase 0** — Esqueleto (Vite + TS + Three.js + React, loop de tick fixo, RNG semeado)
- ✅ **Fase 1 (MVP)** — Agentes vivendo: necessidades → IA → A* → movimento → ação; ciclo dia/noite; HUD
- ✅ **IA Avançada** — cérebro neural por agente (MLP + REINFORCE), personalidade, emoções, vida social (amizades/rivalidades) e economia
- ✅ **Fase 2** — Persistência (salvar/carregar mundo + pesos das redes) e controles de tempo (pausar/1×/2×/4×/8×, autosave)
- ✅ **Fase 3** — Modo Arquiteto (criar/remover agentes, blecaute, festa na praça, glitch de interferência)
- ✅ **Fase 4** — SQLite WASM persistente (OPFS/IndexedDB) + escala (48 agentes iniciais, instancing, social por vizinhança)
- ⬜ Fase 5 — Modo Avatar
- ⬜ Fase 6 — Polimento Matrix
- ◐ **Civilização** — distrito, moradia/famílias, instituições com empregos/salários, cadeia produtiva, chat, veículos, transporte e eleições

## Rodar

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Outros comandos:

```bash
npm test         # testes do núcleo (determinismo)
npm run build    # build de produção
npm run verify   # typecheck + testes + build
```

## Stack

- TypeScript, React, Zustand
- Three.js
- Vite
- sql.js / SQLite WASM
- Vitest

## Quality

The simulation core is intentionally separated from rendering:

- `src/sim/`: deterministic world state and systems
- `src/render/`: Three.js projection of the world state
- `src/ui/`: React HUD and controls
- `src/persistence/`: JSON and SQLite WASM persistence

Public release checks:

```bash
npm audit --omit=dev
npm run verify
```

## Como funciona

O **núcleo de simulação** (`src/sim/`) é TypeScript puro, sem Three.js, e avança
o mundo em *ticks* de tamanho fixo. A camada de **render** (`src/render/`) só lê
o estado e desenha.

### IA dos agentes (cérebro neural)

Cada agente tem uma **mini rede neural** (`brain.ts`: MLP 13→16→6) treinada online
por **REINFORCE** (policy gradient). A cada decisão:

1. **Percebe** o mundo (necessidades, dinheiro, emoção, hora, vizinhança) → vetor de 13 números.
2. A rede produz uma **política** sobre 6 ações (dormir, comer, socializar, divertir, trabalhar, vaguear).
3. **Amostra** uma ação (explora) e age no mundo.
4. **Aprende**: a recompensa é a variação do *bem-estar* — a rede reforça ações que melhoraram a vida do agente.

Sobre isso há **personalidade** (5 traços estáveis que enviesam decisões),
**emoções** (humor/stress dinâmicos), **vida social** (afinidade que cria amizades
e rivalidades, com linhas visíveis no mundo) e **economia** (trabalho paga,
consumo custa, dinheiro circula). O mundo agora é um **distrito 48×48** com
residências, lojas, lazer, prefeitura e trabalhos. Lojas/instituições têm caixa,
estoque, dono, empregados, salário e transações; compras, impostos, dividendos e
salários movimentam a economia institucional. Agentes têm casa e domicílio;
dormir mira a própria residência e convivência em casa fortalece relações
familiares. Trabalho gera produção no empregador, e uma cadeia simples de
suprimento move estoque de produtores para lojas/lazer com baixa oferta.

A simulação também tem **chat local** e **eleições periódicas**: agentes viram
candidatos por ambição/capital social, fazem campanha com propostas explícitas,
e a população vota por afinidade, traços, alinhamento de política e aprovação do
governo. Cada prefeito define uma plataforma com imposto, assistência social,
subsídio de transporte e apoio ao mercado. Essas políticas movem orçamento
público, repõem estoque, reduzem stress de moradores pobres, alteram a velocidade
do tráfego e mudam a aprovação para a próxima eleição. Há também **veículos
autônomos** circulando por rotas urbanas persistentes; agentes em trajetos longos
podem pagar tarifa subsidiada, caminhar até uma parada e embarcar em modo de
deslocamento por transporte.
Comportamento e dinâmicas sociais **emergem** — não são roteirizados.

> Clique em qualquer agente para abrir o **inspetor**: ver o cérebro (recompensa),
> personalidade, necessidades, emoções, dinheiro e relações.

### Controles (Fase 2)

Barra inferior e atalhos de teclado:

| Ação | Atalho |
|------|--------|
| Pausar / retomar | `Espaço` |
| Acelerar / desacelerar (⏸/1×/2×/4×/8×) | `↑` / `↓` (ou `+` / `-`) |
| Salvar rápido (localStorage) | `S` |
| Carregar rápido | `L` |
| Criar agente | `A` |
| Criar 25 agentes | `Shift+A` |
| Remover agente selecionado (ou o mais novo) | `Del` / `Backspace` |
| Injetar blecaute | `B` |
| Injetar festa na praça | `P` |
| Desselecionar agente | `Esc` |

Também há botões para **exportar/importar** o mundo como arquivo `.json` e gerar
um **mundo novo** (✨). O **Modo Arquiteto** fica na mesma barra: `+ag` cria um
agente, `+25` aumenta a população, `-ag` remove o selecionado (ou o mais novo),
`blk` injeta um blecaute e `prç` convoca uma festa na praça. Toda interferência
dispara um glitch visual.

O estado é **autossalvo a cada 30s** em **SQLite WASM** persistido no OPFS do
navegador (ou IndexedDB/localStorage como fallback) e retomado automaticamente ao
reabrir. O save inclui **os pesos das redes neurais**, então os agentes continuam
exatamente com o que aprenderam.

Estrutura completa em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
