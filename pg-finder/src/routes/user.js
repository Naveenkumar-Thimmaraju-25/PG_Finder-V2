const express = require('express');
const pool = require('../db');
const asyncHandler = require('../middleware/async');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// --------------------------------------------------------------- favourites
router.get('/favorites', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT v.* FROM favorites f
       JOIN v_pg_summary v ON v.id = f.pg_id
      WHERE f.user_id = ? AND v.is_active = 1
      ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json({
    results: rows.map((r) => ({
      id: r.id, title: r.title, city: r.city, area: r.area, landmark: r.landmark,
      rent: r.rent, deposit: r.deposit, gender: r.gender, sharing: r.sharing,
      foodIncluded: !!r.food_included, roomsAvailable: r.rooms_available, isVerified: !!r.is_verified,
      coverImage: r.cover_image, avgRating: Number(r.avg_rating) || 0, reviewCount: Number(r.review_count) || 0,
      isFavorite: true,
    })),
  });
}));

router.post('/favorites/:pgId(\\d+)', requireAuth, asyncHandler(async (req, res) => {
  const pgId = Number(req.params.pgId);
  const [rows] = await pool.query('SELECT id FROM pgs WHERE id = ? AND is_active = 1', [pgId]);
  if (!rows[0]) return res.status(404).json({ error: 'This PG could not be found.' });
  await pool.query('INSERT IGNORE INTO favorites (user_id, pg_id) VALUES (?, ?)', [req.user.id, pgId]);
  res.status(201).json({ isFavorite: true });
}));

router.delete('/favorites/:pgId(\\d+)', requireAuth, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM favorites WHERE user_id = ? AND pg_id = ?', [req.user.id, Number(req.params.pgId)]);
  res.json({ isFavorite: false });
}));

// ------------------------------------- owner: enquiries on my listings
router.get('/owner/enquiries', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.email, e.phone, e.message, e.move_in, e.status, e.created_at,
            p.id AS pg_id, p.title AS pg_title
       FROM enquiries e JOIN pgs p ON p.id = e.pg_id
      WHERE p.owner_id = ?
      ORDER BY e.created_at DESC LIMIT 200`,
    [req.user.id]
  );
  res.json({
    results: rows.map((r) => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone, message: r.message,
      moveIn: r.move_in, status: r.status, createdAt: r.created_at, pgId: r.pg_id, pgTitle: r.pg_title,
    })),
  });
}));

router.patch('/owner/enquiries/:id(\\d+)', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const status = (req.body || {}).status;
  if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const [result] = await pool.query(
    `UPDATE enquiries e JOIN pgs p ON p.id = e.pg_id
        SET e.status = ?
      WHERE e.id = ? AND p.owner_id = ?`,
    [status, Number(req.params.id), req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Enquiry not found.' });
  res.json({ ok: true });
}));

module.exports = router;
