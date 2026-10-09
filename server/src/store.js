import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS shipments (
      reference_id TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      order_json TEXT NOT NULL,
      tracking_number TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const getStatement = db.prepare('SELECT * FROM shipments WHERE reference_id = ?');
  const insertStatement = db.prepare(`INSERT OR IGNORE INTO shipments
    (reference_id, payload_hash, provider, status, order_json, created_at, updated_at)
    VALUES (?, ?, ?, 'SUBMITTING', ?, ?, ?)`);
  const updateStatement = db.prepare(`UPDATE shipments
    SET status = ?, tracking_number = ?, updated_at = ? WHERE reference_id = ?`);
  return {
    get(id) { return getStatement.get(id); },
    reserve(order, hash, provider) {
      const now = new Date().toISOString();
      return insertStatement.run(order.referenceId, hash, provider, JSON.stringify(order), now, now).changes === 1;
    },
    retry(order, hash, provider) {
      return db.prepare(`UPDATE shipments SET payload_hash=?, order_json=?, status='SUBMITTING', updated_at=?
        WHERE reference_id=? AND provider=? AND status='REJECTED'`)
        .run(hash, JSON.stringify(order), new Date().toISOString(), order.referenceId, provider).changes === 1;
    },
    finish(id, status, tracking = null) { updateStatement.run(status, tracking, new Date().toISOString(), id); },
    close() { db.close(); },
  };
}
