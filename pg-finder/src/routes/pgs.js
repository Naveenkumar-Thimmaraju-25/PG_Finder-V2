const express = require('express');
const pool = require('../db');
const asyncHandler = require('../middleware/async');
const { requireAuth, requireRole } = require('../middleware/auth');
const v = require('../validate');

const router = express.Router();

const GENDERS = ['male', 'female', 'unisex'];
const SHARINGS = ['single', 'double', 'triple', 'quad'];

const SORTS = {
  newest: 'v.created_at DESC, v.id DESC',
  rent_asc: 'v.rent ASC, v.id ASC',
  rent_desc: 'v.rent DESC, v.id ASC',
  rating: 'v.avg_rating DESC, v.review_count DESC, v.id ASC',
};

// Shape a row for the browser. Owner id and phone are not part of list results.
function card(row) {
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    area: row.area,
    landmark: row.landmark,
    rent: row.rent,
    deposit: row.deposit,
    gender: row.gender,
    sharing: row.sharing,
    foodIncluded: !!row.food_included,
    roomsAvailable: row.rooms_available,
    isVerified: !!row.is_verified,
    coverImage: row.cover_image,
    avgRating: Number(row.avg_rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    isFavorite: !!row.is_favorite,
  };
}

// ---------------------------------------------------------------- search
router.get('/', asyncHandler(async (req, res) => {
  const q = req.query;
  const where = ['v.is_active = 1'];
  const params = [];

  if (q.city) { where.push('v.city = ?'); params.push(v.str(String(q.city), 80)); }

  if (q.q) {
    const like = `%${v.likeEscape(v.str(String(q.q), 100))}%`;
    where.push('(v.title LIKE ? OR v.area LIKE ? OR v.city LIKE ? OR v.landmark LIKE ?)');
    params.push(like, like, like, like);
  }

  const minRent = v.toInt(q.minRent);
  const maxRent = v.toInt(q.maxRent);
  if (minRent !== null && minRent >= 0) { where.push('v.rent >= ?'); params.push(minRent); }
  if (maxRent !== null && maxRent > 0) { where.push('v.rent <= ?'); params.push(maxRent); }

  if (q.gender === 'male' || q.gender === 'female') {
    where.push("(v.gender = ? OR v.gender = 'unisex')");
    params.push(q.gender);
  }

  if (q.sharing) {
    const list = String(q.sharing).split(',').filter((s) => SHARINGS.includes(s));
    if (list.length) {
      where.push(`v.sharing IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }

  if (q.food === '1') where.push('v.food_included = 1');
  if (q.verified === '1') where.push('v.is_verified = 1');

  if (q.amenities) {
    const ids = String(q.amenities).split(',').map((n) => v.toInt(n)).filter((n) => n !== null && n > 0);
    if (ids.length) {
      where.push(
        `v.id IN (SELECT pg_id FROM pg_amenities WHERE amenity_id IN (${ids.map(() => '?').join(',')})
                  GROUP BY pg_id HAVING COUNT(DISTINCT amenity_id) = ?)`
      );
      params.push(...ids, ids.length);
    }
  }

  const order = SORTS[q.sort] || SORTS.newest;
  const limit = Math.min(Math.max(v.toInt(q.limit, 9), 1), 30);
  const page = Math.max(v.toInt(q.page, 1), 1);
  const offset = (page - 1) * limit;
  const userId = req.user ? req.user.id : 0;

  const whereSql = where.join(' AND ');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM v_pg_summary v WHERE ${whereSql}`, params);

  const [rows] = await pool.query(
    `SELECT v.*, (f.user_id IS NOT NULL) AS is_favorite
       FROM v_pg_summary v
       LEFT JOIN favorites f ON f.pg_id = v.id AND f.user_id = ?
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [userId, ...params, limit, offset]
  );

  res.json({ total, page, pages: Math.max(Math.ceil(total / limit), 1), results: rows.map(card) });
}));

// ------------------------------------------------- filter options & stats
router.get('/meta', asyncHandler(async (req, res) => {
  const [cities] = await pool.query(
    'SELECT city, COUNT(*) AS count FROM pgs WHERE is_active = 1 GROUP BY city ORDER BY count DESC, city ASC'
  );
  const [amenities] = await pool.query('SELECT id, name, icon FROM amenities ORDER BY name');
  const [[range]] = await pool.query('SELECT COALESCE(MIN(rent),0) AS minRent, COALESCE(MAX(rent),0) AS maxRent FROM pgs WHERE is_active = 1');
  const [[stats]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM pgs WHERE is_active = 1) AS listings,
            (SELECT COUNT(DISTINCT city) FROM pgs WHERE is_active = 1) AS cities,
            (SELECT COUNT(*) FROM users) AS members`
  );
  res.json({ cities, amenities, rent: range, stats });
}));

// -------------------------------------------- owner: my own listings
router.get('/mine', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT v.*, (SELECT COUNT(*) FROM enquiries e WHERE e.pg_id = v.id) AS enquiry_count
       FROM v_pg_summary v WHERE v.owner_id = ? ORDER BY v.created_at DESC`,
    [req.user.id]
  );
  res.json({ results: rows.map((r) => ({ ...card(r), enquiryCount: Number(r.enquiry_count) || 0, isActive: !!r.is_active })) });
}));

// ----------------------------------------------------------- one listing
router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user ? req.user.id : 0;

  const [rows] = await pool.query(
    `SELECT v.*, u.full_name AS owner_name, (f.user_id IS NOT NULL) AS is_favorite
       FROM v_pg_summary v
       JOIN users u ON u.id = v.owner_id
       LEFT JOIN favorites f ON f.pg_id = v.id AND f.user_id = ?
      WHERE v.id = ? AND v.is_active = 1`,
    [userId, id]
  );
  const pg = rows[0];
  if (!pg) return res.status(404).json({ error: 'This PG could not be found.' });

  const [images] = await pool.query('SELECT url FROM pg_images WHERE pg_id = ? ORDER BY is_cover DESC, sort_order, id', [id]);
  const [amenities] = await pool.query(
    'SELECT a.id, a.name, a.icon FROM pg_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.pg_id = ? ORDER BY a.name',
    [id]
  );
  const [reviews] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.pg_id = ? ORDER BY r.created_at DESC LIMIT 50`,
    [id]
  );

  res.json({
    ...card(pg),
    description: pg.description,
    address: pg.address,
    latitude: pg.latitude === null ? null : Number(pg.latitude),
    longitude: pg.longitude === null ? null : Number(pg.longitude),
    ownerName: pg.owner_name,
    isOwner: !!req.user && req.user.id === pg.owner_id,
    // Phone numbers are only shown to logged-in users to limit scraping.
    contactPhone: req.user ? pg.contact_phone : null,
    images: images.map((i) => i.url),
    amenities,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at, name: r.full_name })),
  });
}));

// --------------------------------------------------------- create listing
router.post('/', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const title = v.str(b.title, 150);
  const city = v.str(b.city, 80);
  const area = v.str(b.area, 100);
  const rent = v.toInt(b.rent);
  const deposit = v.toInt(b.deposit, 0);
  const rooms = v.toInt(b.roomsAvailable, 1);
  const phone = b.contactPhone ? v.normalizePhone(String(b.contactPhone)) : null;
  const gender = GENDERS.includes(b.gender) ? b.gender : 'unisex';
  const sharing = SHARINGS.includes(b.sharing) ? b.sharing : 'double';

  if (title.length < 5) return res.status(400).json({ error: 'Give the listing a title (at least 5 characters).' });
  if (!city || !area) return res.status(400).json({ error: 'City and area are required.' });
  if (rent === null || rent < 500 || rent > 500000) return res.status(400).json({ error: 'Enter a monthly rent between 500 and 500000.' });
  if (deposit < 0 || deposit > 2000000) return res.status(400).json({ error: 'Enter a valid deposit amount.' });
  if (rooms < 0 || rooms > 200) return res.status(400).json({ error: 'Enter a valid number of rooms.' });
  if (b.contactPhone && !phone) return res.status(400).json({ error: 'Enter a valid 10-digit contact number.' });

  const images = (Array.isArray(b.images) ? b.images : []).map((u) => v.str(u, 500)).filter(Boolean).slice(0, 6);
  if (!images.every(v.isHttpUrl)) return res.status(400).json({ error: 'Image links must start with http:// or https://' });

  const amenityIds = (Array.isArray(b.amenities) ? b.amenities : [])
    .map((n) => v.toInt(n)).filter((n) => n !== null && n > 0).slice(0, 30);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO pgs (owner_id, title, description, city, area, address, landmark, rent, deposit,
                        gender, sharing, food_included, rooms_available, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, v.str(b.description, 4000) || null, city, area, v.str(b.address, 255) || null,
       v.str(b.landmark, 150) || null, rent, deposit, gender, sharing, b.foodIncluded ? 1 : 0, rooms, phone]
    );
    const pgId = ins.insertId;

    if (amenityIds.length) {
      await conn.query(
        'INSERT IGNORE INTO pg_amenities (pg_id, amenity_id) SELECT ?, id FROM amenities WHERE id IN (?)',
        [pgId, amenityIds]
      );
    }
    if (images.length) {
      await conn.query(
        'INSERT INTO pg_images (pg_id, url, is_cover, sort_order) VALUES ?',
        [images.map((url, i) => [pgId, url, i === 0 ? 1 : 0, i])]
      );
    }
    await conn.commit();
    res.status(201).json({ id: pgId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// --------------------------------------------------------- delete listing
router.delete('/:id(\\d+)', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'DELETE FROM pgs WHERE id = ? AND (owner_id = ? OR ? = 1)',
    [Number(req.params.id), req.user.id, req.user.role === 'admin' ? 1 : 0]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ reviews
router.post('/:id(\\d+)/reviews', requireAuth, asyncHandler(async (req, res) => {
  const pgId = Number(req.params.id);
  const rating = v.toInt((req.body || {}).rating);
  const comment = v.str((req.body || {}).comment, 1000) || null;
  if (rating === null || rating < 1 || rating > 5) return res.status(400).json({ error: 'Choose a rating from 1 to 5.' });

  const [rows] = await pool.query('SELECT owner_id FROM pgs WHERE id = ? AND is_active = 1', [pgId]);
  if (!rows[0]) return res.status(404).json({ error: 'This PG could not be found.' });
  if (rows[0].owner_id === req.user.id) return res.status(403).json({ error: 'You cannot review your own listing.' });

  await pool.query(
    `INSERT INTO reviews (pg_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP`,
    [pgId, req.user.id, rating, comment]
  );
  res.status(201).json({ ok: true });
}));

// ---------------------------------------------------------------- enquiries
router.post('/:id(\\d+)/enquiries', asyncHandler(async (req, res) => {
  const pgId = Number(req.params.id);
  const b = req.body || {};
  const name = v.str(b.name, 100);
  const email = v.str(b.email, 150).toLowerCase();
  const phone = b.phone ? v.normalizePhone(String(b.phone)) : null;
  const message = v.str(b.message, 1000);
  const moveIn = /^\d{4}-\d{2}-\d{2}$/.test(b.moveIn || '') ? b.moveIn : null;

  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!v.isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (b.phone && !phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (message.length < 5) return res.status(400).json({ error: 'Write a short message for the owner.' });

  const [rows] = await pool.query('SELECT id FROM pgs WHERE id = ? AND is_active = 1', [pgId]);
  if (!rows[0]) return res.status(404).json({ error: 'This PG could not be found.' });

  await pool.query(
    'INSERT INTO enquiries (pg_id, user_id, name, email, phone, message, move_in) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [pgId, req.user ? req.user.id : null, name, email, phone, message, moveIn]
  );
  res.status(201).json({ message: 'Your enquiry has been sent to the owner.' });
}));

module.exports = router;
