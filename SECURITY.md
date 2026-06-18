# Security Policy

Matrix-Sim is an offline-first browser simulation. It does not require a backend,
authentication, or API keys.

## Reporting

Please report security concerns through GitHub issues if they do not contain
sensitive exploit details. For sensitive reports, contact the repository owner
privately through GitHub.

## Data Handling

- Autosaves are stored locally in the browser through SQLite WASM and OPFS or
  IndexedDB fallback.
- Exported `.json` worlds may contain complete simulated agent state and should
  be shared intentionally.
- Do not commit real personal data, credentials, browser storage dumps, or
  exported private worlds.
