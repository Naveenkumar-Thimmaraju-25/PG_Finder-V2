// Creates the database, tables, demo users and sample listings.
//   npm run db:init
// Safe to run again: existing data is kept, sample listings are only added to an empty database.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config');

const sqlDir = path.join(__dirname, '..', '..', 'sql');
const read = (f) => fs.readFileSync(path.join(sqlDir, f), 'utf8').replaceAll('pg_finder', config.db.database);

const DEMO_USERS = [
  { name: 'Demo Owner', email: 'owner@pgfinder.demo', username: 'demo_owner', phone: '9042943853', role: 'owner', password: 'Owner@1234' },
  { name: 'Demo Tenant', email: 'tenant@pgfinder.demo', username: 'demo_tenant', phone: null, role: 'tenant', password: 'Tenant@1234' },
];

(async () => {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    console.log('Creating schema...');
    await conn.query(read('schema.sql'));
    await conn.query(`USE \`${config.db.database}\``);

    for (const u of DEMO_USERS) {
      const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (rows.length) continue;
      const hash = await bcrypt.hash(u.password, 12);
      await conn.query(
        'INSERT INTO users (full_name, email, username, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        [u.name, u.email, u.username, u.phone, hash, u.role]
      );
      console.log(`Created demo ${u.role}: ${u.email} / ${u.password}`);
    }

    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM pgs');
    if (n === 0) {
      console.log('Adding sample listings...');
      await conn.query(read('seed.sql'));
    } else {
      console.log(`Skipping sample listings (${n} already exist).`);
    }
    console.log('Done. Start the app with: npm start');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
