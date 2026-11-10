const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const config = require('../config');
const asyncHandler = require('../middleware/async');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { sendMail, sendSms } = require('../mailer');
const v = require('../validate');

const router = express.Router();

const limiterOpts = (max) => ({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
const authLimiter = rateLimit(limiterOpts(30));
const recoveryLimiter = rateLimit(limiterOpts(8));

// Compared against when the user does not exist, so response time does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function publicUser(u) {
  return { id: u.id, fullName: u.full_name, email: u.email, username: u.username, role: u.role };
}

// Creates a single-use reset token (stored hashed) and returns the raw token.
async function issueResetToken(userId, minutes) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
  await pool.query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, sha256(token), minutes]
  );
  return token;
}

// ---------------------------------------------------------------- register
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const fullName = v.str(b.fullName, 100);
  const email = v.str(b.email, 150).toLowerCase();
  const username = v.str(b.username, 30);
  const password = b.password;
  const role = b.role === 'owner' ? 'owner' : 'tenant';
  const phone = b.phone ? v.normalizePhone(String(b.phone)) : null;
  const recoveryQuestion = v.str(b.recoveryQuestion, 200);
  const recoveryAnswer = v.str(b.recoveryAnswer, 100).toLowerCase();

  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!v.isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!v.isUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters: letters, numbers or underscore.' });
  }
  if (b.phone && !phone) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
  const pwProblem = v.passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });
  if (b.confirmPassword !== undefined && b.confirmPassword !== password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  if ((recoveryQuestion && !recoveryAnswer) || (!recoveryQuestion && recoveryAnswer)) {
    return res.status(400).json({ error: 'Provide both a recovery question and its answer, or neither.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const answerHash = recoveryAnswer ? await bcrypt.hash(recoveryAnswer, 10) : null;

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO users (full_name, email, username, phone, password_hash, role, recovery_question, recovery_answer_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, username, phone, passwordHash, role, recoveryQuestion || null, answerHash]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      let field = 'email';
      if (/uq_users_username/.test(err.message)) field = 'username';
      else if (/uq_users_phone/.test(err.message)) field = 'mobile number';
      return res.status(409).json({ error: `That ${field} is already registered.` });
    }
    throw err;
  }

  const user = { id: result.insertId, full_name: fullName, email, username, role };
  setAuthCookie(res, user, false);
  res.status(201).json({ user: publicUser(user) });
}));

// ------------------------------------------------------------------- login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const identifier = v.str((req.body || {}).identifier, 150);
  const password = typeof (req.body || {}).password === 'string' ? req.body.password : '';
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your username or email and your password.' });
  }

  const [rows] = await pool.query(
    'SELECT id, full_name, email, username, role, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1',
    [identifier, identifier]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Incorrect username/email or password.' });

  setAuthCookie(res, user, !!req.body.remember);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', asyncHandler(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const [rows] = await pool.query('SELECT id, full_name, email, username, role FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) {
    clearAuthCookie(res);
    return res.json({ user: null });
  }
  res.json({ user: publicUser(rows[0]) });
}));

// ------------------------------------------------- forgot password (email)
router.post('/forgot', recoveryLimiter, asyncHandler(async (req, res) => {
  const email = v.str((req.body || {}).email, 150).toLowerCase();
  if (!v.isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const [rows] = await pool.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
  if (rows[0]) {
    const token = await issueResetToken(rows[0].id, 30);
    const link = `${config.appUrl}/reset.html?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Reset your PG Finder password',
      text: `Hi ${rows[0].full_name},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    });
  }
  // Same answer whether or not the email exists.
  res.json({ message: 'If that email is registered, a reset link is on its way.' });
}));

// --------------------------------------------- other ways: phone OTP
router.post('/recovery/otp', recoveryLimiter, asyncHandler(async (req, res) => {
  const phone = v.normalizePhone(String((req.body || {}).phone || ''));
  if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });

  const [rows] = await pool.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
  if (rows[0]) {
    const [[recent]] = await pool.query(
      'SELECT COUNT(*) AS n FROM otp_codes WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [rows[0].id]
    );
    if (recent.n < 3) {
      const code = String(crypto.randomInt(100000, 1000000));
      const hash = await bcrypt.hash(code, 10);
      await pool.query(
        'INSERT INTO otp_codes (user_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
        [rows[0].id, hash]
      );
      await sendSms(phone, `Your PG Finder verification code is ${code}. It expires in 10 minutes.`);
    }
  }
  res.json({ message: 'If that number is registered, a 6-digit code has been sent.' });
}));

router.post('/recovery/verify-otp', recoveryLimiter, asyncHandler(async (req, res) => {
  const phone = v.normalizePhone(String((req.body || {}).phone || ''));
  const otp = v.str((req.body || {}).otp, 6);
  if (!phone || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter your number and the 6-digit code.' });

  const fail = () => res.status(400).json({ error: 'That code is incorrect or has expired.' });

  const [users] = await pool.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
  if (!users[0]) return fail();

  const [codes] = await pool.query(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [users[0].id]
  );
  const row = codes[0];
  if (!row || row.attempts >= 5) return fail();

  const ok = await bcrypt.compare(otp, row.code_hash);
  if (!ok) {
    await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return fail();
  }
  await pool.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ?', [row.id]);
  const resetToken = await issueResetToken(users[0].id, 15);
  res.json({ resetToken });
}));

// ------------------------------------ other ways: recovery question
router.post('/recovery/question', recoveryLimiter, asyncHandler(async (req, res) => {
  const username = v.str((req.body || {}).username, 30);
  const [rows] = await pool.query(
    'SELECT recovery_question FROM users WHERE username = ? AND recovery_question IS NOT NULL LIMIT 1',
    [username]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'No recovery question is available for that username. Try another method.' });
  }
  res.json({ question: rows[0].recovery_question });
}));

router.post('/recovery/answer', recoveryLimiter, asyncHandler(async (req, res) => {
  const username = v.str((req.body || {}).username, 30);
  const answer = v.str((req.body || {}).answer, 100).toLowerCase();
  if (!username || !answer) return res.status(400).json({ error: 'Enter your username and answer.' });

  const [rows] = await pool.query(
    'SELECT id, recovery_answer_hash FROM users WHERE username = ? AND recovery_answer_hash IS NOT NULL LIMIT 1',
    [username]
  );
  const ok = await bcrypt.compare(answer, rows[0] ? rows[0].recovery_answer_hash : DUMMY_HASH);
  if (!rows[0] || !ok) return res.status(400).json({ error: 'That answer is not correct.' });

  const resetToken = await issueResetToken(rows[0].id, 15);
  res.json({ resetToken });
}));

// ------------------------------------------------------- set new password
router.post('/reset', recoveryLimiter, asyncHandler(async (req, res) => {
  const token = v.str((req.body || {}).token, 128);
  const password = (req.body || {}).password;
  const pwProblem = v.passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'This reset link is invalid.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE',
      [sha256(token)]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    const hash = await bcrypt.hash(password, 12);
    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
    await conn.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [rows[0].user_id]);
    await conn.commit();
    res.json({ message: 'Password updated. You can log in now.' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
