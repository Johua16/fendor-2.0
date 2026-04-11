const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "fendor.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let databaseInstance = null;

function getDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  databaseInstance = new sqlite3.Database(DB_PATH);
  return databaseInstance;
}

function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function all(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

async function initializeDatabase() {
  const database = getDatabase();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");

  await exec(database, schema);
  await run(database, "PRAGMA foreign_keys = ON;");
  await ensureOrdersColumns(database);
  await ensureVendorColumns(database);

  return database;
}

async function ensureOrdersColumns(database) {
  const columns = await all(database, "PRAGMA table_info(orders)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("product_id")) {
    await run(database, "ALTER TABLE orders ADD COLUMN product_id INTEGER");
  }

  if (!columnNames.has("vendor_id")) {
    await run(database, "ALTER TABLE orders ADD COLUMN vendor_id INTEGER");
  }
}

async function ensureVendorColumns(database) {
  const columns = await all(database, "PRAGMA table_info(vendors)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("application_id")) {
    await run(database, "ALTER TABLE vendors ADD COLUMN application_id INTEGER");
  }

  if (!columnNames.has("approved_by_admin_id")) {
    await run(database, "ALTER TABLE vendors ADD COLUMN approved_by_admin_id INTEGER");
  }

  if (!columnNames.has("approved_at")) {
    await run(database, "ALTER TABLE vendors ADD COLUMN approved_at TEXT");
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  run,
  all,
  get,
};
