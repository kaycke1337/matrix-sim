import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { World } from "../sim/world";
import {
  deserializeWorld,
  serializeWorld,
  type WorldData,
} from "../sim/serialize";

const DB_FILE = "matrix-sim.sqlite";
const IDB_NAME = "matrix-sim";
const IDB_STORE = "sqlite";
const IDB_KEY = "main";

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

interface PersistedDatabase {
  db: Database;
  backend: "opfs" | "indexeddb" | "memory";
}

function initSql(): ReturnType<typeof initSqlJs> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

export async function saveWorldSqlite(world: World): Promise<boolean> {
  const persisted = await openPersistedDatabase();
  const { db, backend } = persisted;
  const savedAt = new Date().toISOString();
  const data = serializeWorld(world, savedAt);

  db.run("BEGIN IMMEDIATE");
  try {
    db.run(
      `INSERT INTO world_snapshots
        (id, saved_at, tick, agent_count, budget, tax_rate, approval, campaign_count, payload_json)
       VALUES ('latest', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        saved_at = excluded.saved_at,
        tick = excluded.tick,
        agent_count = excluded.agent_count,
        budget = excluded.budget,
        tax_rate = excluded.tax_rate,
        approval = excluded.approval,
        campaign_count = excluded.campaign_count,
        payload_json = excluded.payload_json`,
      [
        savedAt,
        data.tick,
        data.agents.length,
        world.civics.budget,
        world.civics.policy.taxRate,
        world.civics.approval,
        world.civics.activeProposals.length,
        JSON.stringify(data),
      ]
    );

    db.run("DELETE FROM agent_index WHERE snapshot_id = 'latest'");
    db.run("DELETE FROM institution_index WHERE snapshot_id = 'latest'");
    db.run("DELETE FROM household_index WHERE snapshot_id = 'latest'");
    const stmt = db.prepare(
      `INSERT INTO agent_index
        (snapshot_id, id, name, job, money, x, z, fsm, current_action)
       VALUES ('latest', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const agent of world.agents) {
        stmt.bind([
          agent.id,
          agent.name,
          agent.job,
          agent.money,
          agent.pos.x,
          agent.pos.z,
          agent.fsm,
          agent.currentAction,
        ]);
        stmt.step();
      }
    } finally {
      stmt.free();
    }

    const instStmt = db.prepare(
      `INSERT INTO institution_index
        (snapshot_id, id, poi_id, name, kind, owner_id, cash, stock, wage, employee_count, transactions)
       VALUES ('latest', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const institution of world.institutions) {
        instStmt.bind([
          institution.id,
          institution.poiId,
          institution.name,
          institution.kind,
          institution.ownerId,
          institution.cash,
          institution.stock,
          institution.wage,
          institution.employees.length,
          institution.transactions,
        ]);
        instStmt.step();
      }
    } finally {
      instStmt.free();
    }

    const householdStmt = db.prepare(
      `INSERT INTO household_index
        (snapshot_id, id, home_poi_id, name, member_count, rent, shared_cash)
       VALUES ('latest', ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const household of world.households) {
        householdStmt.bind([
          household.id,
          household.homePoiId,
          household.name,
          household.members.length,
          household.rent,
          household.sharedCash,
        ]);
        householdStmt.step();
      }
    } finally {
      householdStmt.free();
    }
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    db.close();
    throw error;
  }

  const bytes = db.export();
  db.close();
  await writeDatabaseBytes(bytes, backend);
  return true;
}

export async function loadWorldSqlite(): Promise<World | null> {
  const persisted = await openPersistedDatabase();
  const { db } = persisted;
  try {
    const stmt = db.prepare(
      "SELECT payload_json FROM world_snapshots WHERE id = 'latest'"
    );
    try {
      if (!stmt.step()) return null;
      const row = stmt.getAsObject();
      const payload = row.payload_json;
      if (typeof payload !== "string") return null;
      return deserializeWorld(JSON.parse(payload) as WorldData);
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
}

export async function hasWorldSqlite(): Promise<boolean> {
  const bytes = await readDatabaseBytes();
  return bytes != null && bytes.byteLength > 0;
}

export async function exportSqliteBytes(): Promise<Uint8Array | null> {
  return readDatabaseBytes();
}

export async function clearWorldSqlite(): Promise<void> {
  if (canUseOpfs()) {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(DB_FILE);
    } catch {
      // already absent or browser refused; keep clearing fallbacks below
    }
  }
  await writeIndexedDb(null);
}

async function openPersistedDatabase(): Promise<PersistedDatabase> {
  const SQL = await initSql();
  const { bytes, backend } = await readPreferredDatabaseBytes();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  migrate(db);
  return { db, backend };
}

function migrate(db: Database): void {
  db.run(`
    PRAGMA user_version = 1;
    CREATE TABLE IF NOT EXISTS world_snapshots (
      id TEXT PRIMARY KEY,
      saved_at TEXT NOT NULL,
      tick INTEGER NOT NULL,
      agent_count INTEGER NOT NULL,
      budget REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      approval REAL NOT NULL DEFAULT 0,
      campaign_count INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_index (
      snapshot_id TEXT NOT NULL,
      id INTEGER NOT NULL,
      name TEXT NOT NULL,
      job TEXT NOT NULL,
      money REAL NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      fsm TEXT NOT NULL,
      current_action TEXT,
      PRIMARY KEY (snapshot_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_index_snapshot
      ON agent_index(snapshot_id, name);
    CREATE TABLE IF NOT EXISTS institution_index (
      snapshot_id TEXT NOT NULL,
      id TEXT NOT NULL,
      poi_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      owner_id INTEGER,
      cash REAL NOT NULL,
      stock REAL NOT NULL,
      wage REAL NOT NULL DEFAULT 0,
      employee_count INTEGER NOT NULL DEFAULT 0,
      transactions INTEGER NOT NULL,
      PRIMARY KEY (snapshot_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_institution_index_snapshot
      ON institution_index(snapshot_id, kind);
    CREATE TABLE IF NOT EXISTS household_index (
      snapshot_id TEXT NOT NULL,
      id INTEGER NOT NULL,
      home_poi_id TEXT NOT NULL,
      name TEXT NOT NULL,
      member_count INTEGER NOT NULL,
      rent REAL NOT NULL,
      shared_cash REAL NOT NULL,
      PRIMARY KEY (snapshot_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_household_index_snapshot
      ON household_index(snapshot_id, home_poi_id);
  `);
  addColumnIfMissing(db, "world_snapshots", "budget", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "world_snapshots", "tax_rate", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "world_snapshots", "approval", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(
    db,
    "world_snapshots",
    "campaign_count",
    "INTEGER NOT NULL DEFAULT 0"
  );
  addColumnIfMissing(db, "institution_index", "wage", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(
    db,
    "institution_index",
    "employee_count",
    "INTEGER NOT NULL DEFAULT 0"
  );
}

function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  definition: string
): void {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // SQLite throws when the column already exists; that is the desired state.
  }
}

async function readPreferredDatabaseBytes(): Promise<{
  bytes: Uint8Array | null;
  backend: PersistedDatabase["backend"];
}> {
  if (canUseOpfs()) {
    const bytes = await readOpfs();
    return { bytes, backend: "opfs" };
  }
  if (canUseIndexedDb()) {
    return { bytes: await readIndexedDb(), backend: "indexeddb" };
  }
  return { bytes: null, backend: "memory" };
}

async function readDatabaseBytes(): Promise<Uint8Array | null> {
  if (canUseOpfs()) {
    const bytes = await readOpfs();
    if (bytes) return bytes;
  }
  if (canUseIndexedDb()) return readIndexedDb();
  return null;
}

async function writeDatabaseBytes(
  bytes: Uint8Array,
  backend: PersistedDatabase["backend"]
): Promise<void> {
  if (backend === "opfs") {
    await writeOpfs(bytes);
    return;
  }
  if (backend === "indexeddb") {
    await writeIndexedDb(bytes);
  }
}

function canUseOpfs(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

async function readOpfs(): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(DB_FILE);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function writeOpfs(bytes: Uint8Array): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(DB_FILE, { create: true });
  const writable = await handle.createWritable();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  await writable.write(buffer);
  await writable.close();
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function readIndexedDb(): Promise<Uint8Array | null> {
  if (!canUseIndexedDb()) return null;
  const db = await openIndexedDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const value = req.result;
        resolve(value instanceof Uint8Array ? value : null);
      };
    });
  } finally {
    db.close();
  }
}

async function writeIndexedDb(bytes: Uint8Array | null): Promise<void> {
  if (!canUseIndexedDb()) return;
  const db = await openIndexedDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const req = bytes ? store.put(bytes, IDB_KEY) : store.delete(IDB_KEY);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  } finally {
    db.close();
  }
}
