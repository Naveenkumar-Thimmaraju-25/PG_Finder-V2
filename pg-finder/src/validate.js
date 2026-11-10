const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// Trim a value to a string no longer than max.
function str(value, max = 255) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isEmail(value) {
  return typeof value === 'string' && value.length <= 150 && EMAIL_RE.test(value);
}

function isUsername(value) {
  return typeof value === 'string' && USERNAME_RE.test(value);
}

// Indian mobile numbers. Accepts +91 / spaces / dashes; returns the 10 digits or null.
function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

// Returns a message describing what is wrong, or null if the password is acceptable.
function passwordProblem(password) {
  if (typeof password !== 'string') return 'Enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (e) {
    return false;
  }
}

function toInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Escape % and _ so user text is matched literally inside LIKE.
function likeEscape(value) {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

module.exports = { str, isEmail, isUsername, normalizePhone, passwordProblem, isHttpUrl, toInt, likeEscape };
