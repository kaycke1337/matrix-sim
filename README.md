# Matrix-Sim

Simulação 3D no navegador inspirada no filme *Matrix*: um quarteirão pequeno e
persistente habitado por agentes autônomos (regras + máquina de estados).

> Documento de visão e arquitetura: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

## Status

- ✅ **Fase 0** — Esqueleto (Vite + TS + Three.js + React, loop de tick fixo, RNG semeado)
- ✅ **Fase 1 (MVP)** — Agentes vivendo: necessidades → IA → A* → movimento → ação; ciclo dia/noite; HUD
- ✅ **IA Avançada** — cérebro neural por agente (MLP + REINFORCE), personalidade, emoções, vida social (amizades/rivalidades) e economia
- ✅ **Fase 2** — Persistência (salvar/carregar mundo + pesos das redes) e controles de tempo (pausar/1×/2×/4×/8×, autosave)
- ⬜ Fase 3 — Modo Arquiteto
- ⬜ Fase 4 — SQLite + escala
- ⬜ Fase 5 — Modo Avatar
- ⬜ Fase 6 — Polimento Matrix

## Rodar

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Outros comandos:

```bash
npm test         # testes do núcleo (determinismo)
npm run build    # build de produção
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
consumo custa, dinheiro circula). Comportamento e dinâmicas sociais **emergem** —
não são roteirizados.

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
| Desselecionar agente | `Esc` |

Também há botões para **exportar/importar** o mundo como arquivo `.json` e gerar
um **mundo novo** (✨). O estado é **autossalvo a cada 30s** e retomado
automaticamente ao reabrir. O save inclui **os pesos das redes neurais**, então
os agentes continuam exatamente com o que aprenderam.

Estrutura completa em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
