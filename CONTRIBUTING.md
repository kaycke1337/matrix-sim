# Contributing

Matrix-Sim is an experimental autonomous civilization simulation. Contributions
should preserve the core constraint that simulation logic stays deterministic and
independent from rendering.

## Local Setup

```bash
npm install
npm run dev
```

## Quality Gates

Run the full verification suite before opening a PR:

```bash
npm run verify
```

This runs TypeScript type checking, Vitest, and the production build.

## Engineering Principles

- Keep `src/sim/` pure TypeScript with no Three.js or DOM dependencies.
- Keep rendering in `src/render/` as a read-only projection of world state.
- Persist new world state through `src/sim/serialize.ts` with backwards-compatible defaults when possible.
- Add focused headless tests for new simulation systems.
- Preserve deterministic behavior for equal seeds and equal save/load state.

## Security

Do not commit credentials, tokens, exported personal worlds, or browser storage
dumps. Local saves should stay local unless they are intentionally sanitized
fixtures.
