const fs = require('node:fs');
const path = require('node:path');

const dataDirectory = path.join(process.cwd(), 'data');
const databaseFile = path.join(dataDirectory, 'database.json');

let database;

function initializeDatabase() {
  fs.mkdirSync(dataDirectory, {
    recursive: true
  });

  if (!fs.existsSync(databaseFile)) {
    fs.writeFileSync(
      databaseFile,
      JSON.stringify(
        {
          guild_config: {},
          tickets: [],
          next_ticket_id: 1
        },
        null,
        2
      )
    );
  }

  database = JSON.parse(
    fs.readFileSync(databaseFile, 'utf8')
  );

  // Make sure older databases get the tickets array
  if (!Array.isArray(database.tickets)) {
    database.tickets = [];
  }

  if (!database.guild_config) {
    database.guild_config = {};
  }

  if (!database.next_ticket_id) {
    database.next_ticket_id = 1;
  }

  saveDatabase();
}

function saveDatabase() {
  fs.writeFileSync(
    databaseFile,
    JSON.stringify(database, null, 2)
  );
}

function getDatabase() {
  return database;
}

function updateDatabase() {
  saveDatabase();
}

module.exports = {
  initializeDatabase,
  getDatabase,
  updateDatabase
};
