require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:OtQnMrOtrFKxyhRWKoIyxDqwWonzCkmi@tramway.proxy.rlwy.net:27034/railway';

const pool = new Pool({
  connectionString: connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const newRow = { ...row };
  for (const key of Object.keys(row)) {
    const upper = key.toUpperCase();
    const lower = key.toLowerCase();
    newRow[upper] = row[key];
    newRow[lower] = row[key];
  }
  return newRow;
}

function convertSql(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

async function get(sql, params = []) {
  const pgSql = convertSql(sql);
  const res = await pool.query(pgSql, params);
  if (!res.rows || res.rows.length === 0) return null;
  return normalizeRow(res.rows[0]);
}

async function all(sql, params = []) {
  const pgSql = convertSql(sql);
  const res = await pool.query(pgSql, params);
  return (res.rows || []).map(normalizeRow);
}

async function run(sql, params = []) {
  let pgSql = convertSql(sql);
  const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
  if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
    pgSql += ' RETURNING *';
  }
  const res = await pool.query(pgSql, params);
  const normalizedRows = (res.rows || []).map(normalizeRow);
  const firstRow = normalizedRows[0] || {};
  const lastInsertRowid = firstRow.attachment_id || firstRow.ATTACHMENT_ID || firstRow.log_id || firstRow.LOG_ID || null;
  return {
    rowCount: res.rowCount,
    changes: res.rowCount,
    lastInsertRowid: lastInsertRowid,
    rows: normalizedRows,
    firstRow: firstRow
  };
}

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS MASTER_ATTACHMENT (
        ATTACHMENT_ID SERIAL PRIMARY KEY,
        ATTACHMENT_NAME TEXT NOT NULL,
        MIMETYPE TEXT NOT NULL,
        SIZE INTEGER NOT NULL,
        FILE_PATH TEXT NOT NULL,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT
      );

      CREATE TABLE IF NOT EXISTS MASTER_USER (
        PHONE_NO TEXT PRIMARY KEY,
        USER_TYPE TEXT NOT NULL DEFAULT 'REGULAR',
        VALID_FROM TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        VALID_TO TIMESTAMP NOT NULL,
        PHOTO_ATTACHMENT_ID INTEGER,
        NAME TEXT,
        GENDER TEXT,
        PLACE_OF_BIRTH TEXT,
        BIRTHDAY DATE,
        ADDRESS TEXT,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT,
        FOREIGN KEY (PHOTO_ATTACHMENT_ID) REFERENCES MASTER_ATTACHMENT(ATTACHMENT_ID) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS MASTER_CARD (
        CARD_NO TEXT PRIMARY KEY,
        PHONE_NO TEXT NOT NULL,
        NAME TEXT NOT NULL,
        CARD_TYPE TEXT NOT NULL,
        CARD_ATTACHMENT_ID INTEGER,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT,
        FOREIGN KEY (PHONE_NO) REFERENCES MASTER_USER(PHONE_NO) ON DELETE CASCADE,
        FOREIGN KEY (CARD_ATTACHMENT_ID) REFERENCES MASTER_ATTACHMENT(ATTACHMENT_ID) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS TRANSACTION_VISIT (
        VISIT_ID TEXT PRIMARY KEY,
        CARD_NO TEXT NOT NULL,
        CHECK_IN TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK_OUT TIMESTAMP,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT,
        FOREIGN KEY (CARD_NO) REFERENCES MASTER_CARD(CARD_NO) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS MASTER_ADMIN (
        USERNAME TEXT PRIMARY KEY,
        ROLE TEXT NOT NULL DEFAULT 'ADMIN',
        NAME TEXT NOT NULL,
        PASSWORD TEXT NOT NULL,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT
      );

      CREATE TABLE IF NOT EXISTS MASTER_SYSTEM (
        SYSTEM_TYPE TEXT NOT NULL,
        SYSTEM_CD TEXT NOT NULL,
        SYSTEM_VALUE TEXT,
        REMARKS TEXT,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CREATED_BY TEXT DEFAULT 'SYSTEM',
        CHANGED_DT TIMESTAMP,
        CHANGED_BY TEXT,
        PRIMARY KEY (SYSTEM_TYPE, SYSTEM_CD)
      );

      CREATE TABLE IF NOT EXISTS HIST_LOG (
        LOG_ID SERIAL PRIMARY KEY,
        API_URL TEXT,
        METHOD TEXT,
        PARAM_BODY TEXT,
        PARAM_QUERY TEXT,
        RESPONSE TEXT,
        CREATED_DT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default data if empty
    const adminCheck = await get('SELECT COUNT(*) as count FROM MASTER_ADMIN');
    if (parseInt(adminCheck.count || adminCheck.COUNT, 10) === 0) {
      await run(`
        INSERT INTO MASTER_ADMIN (USERNAME, ROLE, NAME, PASSWORD)
        VALUES ('admin', 'ADMIN', 'Super Administrator', 'password123')
      `);
    }

    const systemCheck = await get('SELECT COUNT(*) as count FROM MASTER_SYSTEM');
    if (parseInt(systemCheck.count || systemCheck.COUNT, 10) === 0) {
      await run(`
        INSERT INTO MASTER_SYSTEM (SYSTEM_TYPE, SYSTEM_CD, SYSTEM_VALUE, REMARKS)
        VALUES ('visitor', 'type', 'REGULAR', 'Pengunjung umum')
      `);
      await run(`
        INSERT INTO MASTER_SYSTEM (SYSTEM_TYPE, SYSTEM_CD, SYSTEM_VALUE, REMARKS)
        VALUES ('visitor', 'type_vip', 'VIP', 'Tamu VIP / Eksekutif')
      `);
      await run(`
        INSERT INTO MASTER_SYSTEM (SYSTEM_TYPE, SYSTEM_CD, SYSTEM_VALUE, REMARKS)
        VALUES ('vehicle', 'type_mobil', 'MOBIL', 'Kendaraan roda empat')
      `);
      await run(`
        INSERT INTO MASTER_SYSTEM (SYSTEM_TYPE, SYSTEM_CD, SYSTEM_VALUE, REMARKS)
        VALUES ('vehicle', 'type_motor', 'MOTOR', 'Kendaraan roda dua')
      `);
      await run(`
        INSERT INTO MASTER_SYSTEM (SYSTEM_TYPE, SYSTEM_CD, SYSTEM_VALUE, REMARKS)
        VALUES ('system', 'valid_months', '1', 'Masa berlaku pendaftaran (bulan)')
      `);
    }

    console.log('✅ PostgreSQL tables and seed data initialized successfully.');
  } catch (err) {
    console.error('❌ PostgreSQL Initialization Error:', err);
  }
}

initDatabase();

module.exports = {
  pool,
  get,
  all,
  run,
  query: (text, params) => pool.query(text, params),
  initDatabase,
  normalizeRow
};
