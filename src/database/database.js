const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDirectory = path.join(process.cwd(), 'data');

fs.mkdirSync(dataDirectory, {
  recursive: true
});

const db = new Database(
  path.join(dataDirectory, 'tickets.db')
);

function initializeDatabase() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      staff_role_id TEXT,
      ticket_category_id TEXT,
      transcript_channel_id TEXT,
      log_channel_id TEXT,
      panel_channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT UNIQUE,
      creator_id TEXT NOT NULL,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      claimed_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    );
  `);
}

function getDatabase() {
  return db;
}

module.exports = {
  initializeDatabase,
  getDatabase
};
