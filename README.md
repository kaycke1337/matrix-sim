# Matrix-Sim

Simulação 3D no navegador inspirada no filme *Matrix*: um quarteirão pequeno e
persistente habitado por agentes autônomos (regras + máquina de estados).

> Documento de visão e arquitetura: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

## Status

- ✅ **Fase 0** — Esqueleto (Vite + TS + Three.js + React, loop de tick fixo, RNG semeado)
- ✅ **Fase 1 (MVP)** — Agentes vivendo: necessidades → IA(utility/FSM) → A* → movimento → ação; ciclo dia/noite; HUD básico
- ⬜ Fase 2 — Persistência + controle de tempo
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
o mundo em *ticks* de tamanho fixo (determinístico, com RNG semeado). A camada de
**render** (`src/render/`) só lê o estado e desenha. Isso garante 60 FPS,
save/load reprodutível e permite escalar o mundo sem reescrever a lógica.

- Agentes têm necessidades (energia, fome, social, diversão) que decaem.
- A IA escolhe a necessidade mais urgente, acha um POI no mapa e vai até ele (A*).
- Ao chegar, usa o POI e repõe a necessidade. À noite, dormem.

Estrutura completa em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
