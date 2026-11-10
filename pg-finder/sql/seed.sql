-- Sample data. Needs the demo owner to exist first (npm run db:init creates it).
USE pg_finder;

INSERT IGNORE INTO amenities (name, icon) VALUES
  ('High-Speed Wi-Fi', '🛜'),
  ('Home-cooked Meals', '🍽️'),
  ('Laundry', '🧺'),
  ('24/7 Security', '🔒'),
  ('AC Rooms', '❄️'),
  ('Parking', '🅿️'),
  ('Power Backup', '🔋'),
  ('Housekeeping', '🧹'),
  ('Attached Bathroom', '🚿'),
  ('Gym', '🏋️');

SET @owner = (SELECT id FROM users WHERE email = 'owner@pgfinder.demo' LIMIT 1);

INSERT INTO pgs
  (owner_id, title, description, city, area, address, landmark, latitude, longitude,
   rent, deposit, gender, sharing, food_included, rooms_available, contact_phone, is_verified)
VALUES
  (@owner, 'Sunrise Premium PG for Men',
   'Bright single rooms with study desks, fast Wi-Fi and three meals a day. 8 minutes walk to the Silk Board metro.',
   'Bengaluru', 'HSR Layout', '27th Main Road, Sector 2', 'Near BDA Complex', 12.911600, 77.641200,
   9500, 19000, 'male', 'single', 1, 4, '9042943853', 1),
  (@owner, 'Lakshmi Ladies Residency',
   'Safe, well-lit PG exclusively for women with CCTV, biometric entry and a warden on site.',
   'Bengaluru', 'Koramangala', '5th Block, 80 Feet Road', 'Opp. Forum Mall', 12.935200, 77.624500,
   11000, 22000, 'female', 'double', 1, 3, '9042943853', 1),
  (@owner, 'Greenview Co-living Studios',
   'Modern co-living studios for working professionals with a common lounge, gym and terrace garden.',
   'Bengaluru', 'Whitefield', 'ITPL Main Road', 'Near Phoenix Marketcity', 12.969800, 77.750000,
   13500, 27000, 'unisex', 'single', 0, 6, '9042943853', 1),
  (@owner, 'Budget Stay Triple Sharing',
   'Affordable triple-sharing rooms close to colleges, with home-style food and daily housekeeping.',
   'Bengaluru', 'BTM Layout', '2nd Stage, 16th Main', 'Near Udupi Garden', 12.916600, 77.610100,
   5500, 11000, 'unisex', 'triple', 1, 8, '9042943853', 0),
  (@owner, 'Campus Nest Boys Hostel',
   'Walking distance to the university with a mess, reading room and 24/7 water and power backup.',
   'Pune', 'Kothrud', 'Karve Road', 'Near MIT College', 18.507400, 73.807700,
   6500, 13000, 'male', 'double', 1, 5, '9042943853', 1),
  (@owner, 'Serene Women''s PG',
   'Peaceful PG with AC rooms, attached bathrooms and a rooftop sit-out, near Hinjewadi IT Park.',
   'Pune', 'Hinjewadi', 'Phase 1, Rajiv Gandhi Infotech Park', 'Near Wipro Circle', 18.591200, 73.738900,
   9000, 18000, 'female', 'single', 1, 2, '9042943853', 1),
  (@owner, 'Metro Side Executive PG',
   'Fully furnished rooms two minutes from the metro, ideal for interns and young professionals.',
   'Delhi', 'Laxmi Nagar', 'Vikas Marg', 'Next to Laxmi Nagar Metro', 28.630400, 77.277500,
   8000, 16000, 'unisex', 'double', 0, 4, '9042943853', 1),
  (@owner, 'Hyderabad Tech Stay',
   'Comfortable double and triple rooms with Wi-Fi and meals, minutes from HITEC City.',
   'Hyderabad', 'Madhapur', 'Ayyappa Society Road', 'Near Cyber Towers', 17.448300, 78.391500,
   7500, 15000, 'male', 'double', 1, 6, '9042943853', 0);

-- Photos (ids follow insertion order from the first row above)
SET @first = LAST_INSERT_ID();

INSERT INTO pg_images (pg_id, url, is_cover, sort_order) VALUES
  (@first,     'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900&q=80', 1, 0),
  (@first,     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80',    0, 1),
  (@first + 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80', 1, 0),
  (@first + 1, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&q=80',    0, 1),
  (@first + 2, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80', 1, 0),
  (@first + 2, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80', 0, 1),
  (@first + 3, 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=900&q=80', 1, 0),
  (@first + 4, 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80', 1, 0),
  (@first + 5, 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80', 1, 0),
  (@first + 6, 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=900&q=80', 1, 0),
  (@first + 7, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80', 1, 0);

-- Amenities per PG
INSERT INTO pg_amenities (pg_id, amenity_id)
SELECT p.id, a.id FROM pgs p JOIN amenities a ON a.name IN
  ('High-Speed Wi-Fi','Home-cooked Meals','Laundry','24/7 Security','Power Backup','Housekeeping')
WHERE p.id BETWEEN @first AND @first + 7
ON DUPLICATE KEY UPDATE pg_id = pg_id;

INSERT INTO pg_amenities (pg_id, amenity_id)
SELECT p.id, a.id FROM pgs p JOIN amenities a ON a.name IN ('AC Rooms','Attached Bathroom')
WHERE p.id IN (@first + 1, @first + 2, @first + 5)
ON DUPLICATE KEY UPDATE pg_id = pg_id;

INSERT INTO pg_amenities (pg_id, amenity_id)
SELECT p.id, a.id FROM pgs p JOIN amenities a ON a.name IN ('Gym','Parking')
WHERE p.id IN (@first + 2, @first)
ON DUPLICATE KEY UPDATE pg_id = pg_id;
