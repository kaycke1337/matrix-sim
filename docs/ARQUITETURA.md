# Matrix-Sim — Requisitos & Arquitetura

> Simulação inspirada no filme *Matrix*: um mundo 3D pequeno, persistente e
> evolutivo, habitado por agentes autônomos guiados por regras. O usuário pode
> **observar**, **controlar (modo Arquiteto)** e **entrar como avatar**.

---

## 1. Visão do produto

Um "aquário digital" 3D que roda no navegador. Agentes vivem suas rotinas
(dormir, comer, trabalhar, socializar) num quarteirão pequeno. O mundo continua
de onde parou (estado salvo em disco). A estética é um mundo de aparência normal,
com **toques sutis de Matrix** (tom esverdeado em menus, chuva de código em telas
de loading/HUD, "glitches" ocasionais quando o Arquiteto interfere).

### Decisões já tomadas (do levantamento)

| Tema | Decisão |
|------|---------|
| Essência | Mundo simulado com agentes autônomos |
| Interação | Observar + Controlar + Avatar (os três) |
| Visual | 3D imersivo no navegador (Three.js) |
| Cérebro dos agentes | Regras / máquinas de estado + necessidades (sem LLM) |
| Escala | Pequena (uma sala / quarteirão), projetar p/ crescer |
| Persistência | Arquivo local (SQLite) |
| Estética | Sutil (mundo normal + toques Matrix) |
| Execução | A IA escreve todo o código |
| Entrega | Roteiro completo em fases, começando pelo MVP |

---

## 2. Requisitos

### 2.1 Funcionais

- **RF01** Renderizar um mundo 3D pequeno (quarteirão: ruas, alguns prédios,
  pontos de interesse — casa, trabalho, praça/café).
- **RF02** Popular o mundo com N agentes (alvo inicial: 8–15).
- **RF03** Cada agente tem **necessidades** (energia, fome, social, diversão)
  que decaem com o tempo e o motivam a agir.
- **RF04** Cada agente segue uma **máquina de estados** (Ocioso, Indo-para-X,
  Executando-ação, Dormindo, etc.) e faz **pathfinding** até destinos.
- **RF05** Tempo simulado com **ciclo dia/noite** e velocidade ajustável.
- **RF06** **Persistência**: salvar/carregar o estado completo do mundo em SQLite.
- **RF07** **Modo Observador**: câmera livre orbitando o mundo.
- **RF08** **Modo Arquiteto**: pausar, acelerar/desacelerar tempo, criar/remover
  agentes, inspecionar um agente (ver necessidades/estado), injetar eventos.
- **RF09** **Modo Avatar**: assumir um personagem em 1ª/3ª pessoa e andar pelo mundo.
- **RF10** **HUD** com relógio, estação/dia, lista de agentes e painel de inspeção.
- **RF11** Toques estéticos Matrix: code-rain no loading, glitch ao injetar eventos.

### 2.2 Não-funcionais

- **RNF01** Rodar a 60 FPS com ~15 agentes em um laptop comum.
- **RNF02** Loop de simulação **determinístico** e independente do framerate
  (timestep fixo), para que o save/load seja reprodutível.
- **RNF03** Código modular: **núcleo de simulação separado da renderização**
  (permite rodar a sim "headless" e trocar o renderizador no futuro).
- **RNF04** Uso pessoal, single-player, offline-first. Sem autenticação.
- **RNF05** Projetado para escalar de "quarteirão" para "cidade" sem reescrever o núcleo.

---

## 3. Arquitetura

### 3.1 Princípio central: Simulação ⟂ Renderização

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (cliente)                    │
│                                                               │
│   ┌───────────────────┐        ┌──────────────────────────┐  │
│   │   SIM CORE (puro)  │  tick  │     RENDER (Three.js)     │  │
│   │  - World state     │ ─────► │  - Cena, malhas, câmera   │  │
│   │  - ECS / entidades │ state  │  - Modos: Observador/     │  │
│   │  - Sistemas:       │ ◄───── │    Arquiteto/Avatar       │  │
│   │    needs, AI/FSM,  │ input  │  - HUD (React)            │  │
│   │    pathfind, time  │        │  - Efeitos Matrix         │  │
│   └─────────┬─────────┘        └──────────────────────────┘  │
│             │ snapshot (save/load)                            │
└─────────────┼─────────────────────────────────────────────────┘
              ▼
   ┌─────────────────────┐
   │  Persistência local │  (Fase 1: arquivo JSON;  Fase 4+: SQLite)
   └─────────────────────┘
```

O **Sim Core** é JavaScript/TypeScript puro, sem dependência do Three.js. Ele
avança o mundo em *ticks* de tamanho fixo. A camada de **Render** lê o estado a
cada frame e desenha; ela nunca altera o mundo diretamente — só envia *comandos/inputs*
para o Core (ex.: "criar agente", "pausar", "mover avatar").

### 3.2 Modelo de dados (ECS leve)

Entidades = ids numéricos. Componentes = dados puros. Sistemas = funções que
transformam componentes a cada tick.

**Componentes principais**
- `Transform` { x, y, z, rot }
- `Needs` { energia, fome, social, diversao }  (0..100, decaem por tick)
- `AgentState` { fsm: estado atual, alvo, timer }
- `PathAgent` { caminho[], índice }
- `Identity` { nome, cor, papel }
- `Renderable` { tipoDeMalha }
- `Avatar` (tag — entidade controlada pelo jogador)

**Sistemas (ordem por tick)**
1. `TimeSystem` — avança relógio, dia/noite, estações.
2. `NeedsSystem` — decai necessidades; marca necessidade crítica.
3. `AISystem (FSM)` — decide próxima ação por utilidade simples
   (escolhe a necessidade mais urgente → define alvo).
4. `PathfindingSystem` — A* numa grade de navegação; gera caminho.
5. `MovementSystem` — move ao longo do caminho.
6. `ActionSystem` — ao chegar no alvo, executa ação e repõe a necessidade.
7. `EventSystem` — aplica eventos injetados pelo Arquiteto.

### 3.3 IA dos agentes (sem LLM)

Modelo **utility-based + FSM**:
- A cada decisão, o agente pontua suas necessidades (quanto mais baixa, mais
  urgente) e escolhe a ação que melhor a satisfaz num **ponto de interesse (POI)**
  do mapa (cama→energia, café→fome, praça→social, arcade→diversão).
- FSM: `OCIOSO → INDO_AO_POI → USANDO_POI → OCIOSO`, com `DORMINDO` à noite.
- Isso é barato, escala para centenas de agentes e é 100% determinístico.

### 3.4 Tempo e determinismo

- Loop com **acumulador de timestep fixo** (ex.: 1 tick = 100 ms simulados).
- Render interpola entre o último e o atual estado para suavidade visual.
- Velocidade do tempo (Arquiteto) = quantos ticks de sim por frame real.
- RNG com **seed** salvo no estado → save/load reprodutível.

### 3.5 Persistência

- Estado do mundo = objeto serializável (entidades + componentes + relógio + seed).
- **Fase 1–3**: salvar/baixar como `world.json` (rápido de implementar).
- **Fase 4**: SQLite local. Como o app roda no navegador, duas opções:
  - (a) **sql.js / SQLite WASM** com persistência em OPFS (tudo no navegador,
    zero servidor) — **recomendado** para uso pessoal;
  - (b) um pequeno servidor Node + `better-sqlite3` se quisermos CLI/headless.

---

## 4. Stack proposta

| Camada | Escolha | Porquê |
|--------|---------|--------|
| Linguagem | **TypeScript** | Segurança de tipos no núcleo da sim |
| Build/dev | **Vite** | Servidor de dev rápido, build simples |
| 3D | **Three.js** | Padrão de fato p/ 3D na web |
| HUD/UI | **React** (via @react-three/fiber + drei) | HUD declarativo sobre a cena |
| Estado UI | **Zustand** | Store leve para ligar HUD ↔ comandos do Core |
| Pathfinding | A* próprio sobre grade | Simples e controlável |
| Persistência | JSON → **SQLite WASM (OPFS)** | Offline-first, sem servidor |
| Testes | **Vitest** | Testar o Sim Core headless |

> Alternativa considerada: Godot/Unity (descartado por enquanto — queremos rodar
> no navegador e compartilhar fácil; podemos portar o núcleo depois se necessário).

---

## 5. Estrutura de pastas (proposta)

```
matrix-sim/
├─ docs/
│  └─ ARQUITETURA.md          ← este arquivo
├─ src/
│  ├─ sim/                     ← NÚCLEO (sem Three.js)
│  │  ├─ world.ts             ← estado + ECS
│  │  ├─ components.ts
│  │  ├─ systems/
│  │  │  ├─ time.ts
│  │  │  ├─ needs.ts
│  │  │  ├─ ai.ts
│  │  │  ├─ pathfinding.ts
│  │  │  ├─ movement.ts
│  │  │  └─ action.ts
│  │  ├─ rng.ts               ← RNG com seed
│  │  └─ serialize.ts         ← save/load
│  ├─ render/                  ← Three.js
│  │  ├─ scene.ts
│  │  ├─ agents.ts
│  │  ├─ world-mesh.ts
│  │  └─ cameras/             ← observador / arquiteto / avatar
│  ├─ ui/                      ← React HUD
│  │  ├─ Hud.tsx
│  │  ├─ ArchitectPanel.tsx
│  │  └─ AgentInspector.tsx
│  ├─ fx/                      ← efeitos Matrix (code rain, glitch)
│  ├─ persistence/
│  └─ main.ts                  ← liga tudo (game loop)
├─ tests/                      ← Vitest (sim headless)
├─ index.html
├─ package.json
└─ vite.config.ts
```

---

## 6. Roteiro em fases

Cada fase entrega algo **rodável** e testável.

### Fase 0 — Esqueleto (fundação)
- Setup Vite + TS + Three.js + React; cena vazia; loop de render a 60 FPS.
- Sim Core com loop de timestep fixo (sem agentes ainda) + RNG com seed.
- **Resultado:** janela 3D com chão e câmera orbital; tick contando no console.

### Fase 1 — MVP: agentes vivendo (Observar)  ⭐ ponto de partida
- Mapa do quarteirão (grade de navegação + POIs).
- ECS: 8–15 agentes com `Needs`, `AgentState`, pathfinding A*, movimento.
- Sistemas needs→AI(utility/FSM)→path→move→action.
- Render: agentes como cápsulas coloridas andando; ciclo dia/noite.
- HUD básico: relógio + contador de agentes.
- **Resultado:** o mundo "vive" sozinho e você observa.

### Fase 2 — Persistência + tempo
- Serialização do mundo; salvar/carregar `world.json`.
- Controles de velocidade do tempo (pausar / 1x / 2x / 8x).
- **Resultado:** fechar e reabrir continua de onde parou.

### Fase 3 — Modo Arquiteto
- Painel: pausar, mudar velocidade, **criar/remover agentes**, injetar eventos
  (ex.: "blecaute", "festa na praça"), inspecionar agente selecionado.
- Efeito glitch ao interferir.
- **Status:** implementado com comandos testáveis no Sim Core (`architect.ts`) e
  controles/atalhos na HUD.
- **Resultado:** você controla/edita o mundo.

### Fase 4 — SQLite + escala
- Migrar persistência para SQLite WASM (OPFS); autosave periódico.
- Otimizações p/ subir a contagem de agentes (instancing no Three.js).
- **Status:** implementado com `sql.js`, arquivo SQLite persistido em OPFS
  quando disponível, fallback para IndexedDB/localStorage, índice relacional de
  agentes e renderização por `InstancedMesh`. O sistema social usa buckets
  espaciais para evitar comparação global de todos os pares.
- **Resultado:** base sólida e escalável.

### Fase 5 — Modo Avatar
- Assumir um agente: câmera 1ª/3ª pessoa, controles WASD, colisão simples.
- Interagir com POIs como os agentes.
- **Resultado:** você entra no mundo.

### Fase 6 — Polimento Matrix
- Code-rain no loading/HUD, paleta esverdeada nos menus, glitches,
  som ambiente opcional. Pequenas melhorias de mundo (mais POIs, props).

### Fase 7 — Civilização
- Expandir o mapa de quarteirão para distrito/cidade com zonas residenciais,
  comércio, serviços públicos e espaços cívicos.
- Adicionar veículos e mobilidade urbana (rotas, congestionamento simples,
  transporte público futuro).
- Transformar POIs em lojas/instituições com estoque, preços, empregos e donos.
- Chat local simbólico entre agentes, com memória social persistente.
- Eleições periódicas: candidatos, propostas, voto por preferência e efeitos de
  política pública no mundo.
- **Status:** iniciado com distrito 48×48, POIs urbanos tipados,
  lojas/instituições com caixa/estoque/dono/empregados/salário/transações,
  domicílios com moradores/aluguel/caixa compartilhado, veículos autônomos em
  rotas urbanas persistentes, chat local persistente, eleição periódica,
  candidatos emergentes por traços/capital social, prefeito exibido no HUD e
  políticas públicas com efeitos mensuráveis: impostos, orçamento, assistência
  social, subsídio de transporte e apoio ao estoque/preço das lojas. Agentes em
  trajetos longos já podem usar transporte subsidiado, caminhando até uma parada
  antes de embarcar, com custo, orçamento e tempo de deslocamento afetados.
  Eleições agora têm campanha, propostas
  explícitas, voto por alinhamento de plataforma e aprovação do governo que
  influencia incumbentes. Dormir usa a própria residência e convivência em casa
  fortalece relações familiares. Trabalho gera produção no empregador e uma
  cadeia produtiva simples transfere estoque de instituições produtoras para
  lojas/lazer com oferta baixa. O **mercado de trabalho é dinâmico**: salários
  sobem em empregadores prósperos com vaga e caem quando o caixa não cobre a
  folha; empregadores sem caixa demitem o funcionário menos produtivo (que vira
  desempregado); desempregados são contratados e agentes ambiciosos trocam de
  emprego por salários melhores — tudo determinístico e persistido no save.
- **Resultado:** a simulação deixa de ser só rotina individual e passa a ter
  dinâmica social, econômica e política de civilização.

---

## 7. Riscos & mitigações

- **Escopo grande** → fases pequenas e rodáveis; nada de 3D pesado no MVP.
- **Performance com muitos agentes** → instancing + sim headless testável;
  começar com 15.
- **Determinismo do save/load** → timestep fixo + RNG com seed desde a Fase 0.
- **Complexidade do 3D** → primitivas (cápsulas/caixas) antes de modelos 3D.

---

## 8. Próximo passo

Avançar a **Fase 7** por incrementos. Já feito: mercado de trabalho dinâmico
(salários, demissões e contratação/troca de emprego em `labor.ts`). A seguir:
desembarque visual em veículos, contratos de trabalho com prazo/rescisão e
cadeias produtivas mais ricas (insumos → produtos, múltiplos elos).
