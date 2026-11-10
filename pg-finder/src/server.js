const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const pool = require('./db');
const { attachUser } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https://images.unsplash.com'],
        // Only force https upgrades in production, otherwise http://localhost breaks in some browsers.
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
  })
);

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pgs', require('./routes/pgs'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api', require('./routes/user'));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Central error handler: never leak internals to the browser.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`\nCould not connect to MySQL (${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}).`);
    console.error(`Reason: ${err.code || err.message}`);
    console.error('Check your .env settings and run "npm run db:init" if the database does not exist yet.\n');
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`PG Finder running at http://localhost:${config.port}`);
  });
}

start();
