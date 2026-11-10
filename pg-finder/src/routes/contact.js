const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const asyncHandler = require('../middleware/async');
const v = require('../validate');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have sent several messages already. Please try again later.' },
});

router.post('/', limiter, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 100);
  const email = v.str(b.email, 150).toLowerCase();
  const message = v.str(b.message, 2000);

  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!v.isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (message.length < 10) return res.status(400).json({ error: 'Please write a slightly longer message.' });

  await pool.query('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
  res.status(201).json({ message: 'Thanks! We have received your message and will reply soon.' });
}));

module.exports = router;
