<<<<<<< HEAD
# PG Finder

Find paying-guest (PG) accommodation. Redesigned front end + Node.js/Express API + MySQL.

## Run it locally

You need Node 18+ and MySQL 8+ (or MariaDB 10.5+) running.

```bash
npm install
cp .env.example .env        # then set DB_PASSWORD and JWT_SECRET
npm run db:init             # creates the database, tables, demo users, sample PGs
npm start                   # http://localhost:3000
```

Generate a `JWT_SECRET` with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Demo logins created by `db:init`:

| Role   | Username      | Password     |
|--------|---------------|--------------|
| Owner  | `demo_owner`  | `Owner@1234` |
| Tenant | `demo_tenant` | `Tenant@1234`|

Delete these two accounts before putting the site online.

Prefer to run the SQL yourself? `mysql -u root -p < sql/schema.sql`, create a user with
email `owner@pgfinder.demo`, then `mysql -u root -p < sql/seed.sql`. Passwords must be bcrypt
hashes, so `npm run db:init` is the easy route.

## Project layout

```
sql/schema.sql        tables, indexes, foreign keys, v_pg_summary view
sql/seed.sql          amenities + 8 sample PGs
src/server.js         Express app, security headers, static files
src/routes/auth.js    register, login, logout, me, forgot/reset, OTP + recovery question
src/routes/pgs.js     search + filters, meta, detail, create, delete, reviews, enquiries
src/routes/user.js    favourites, owner enquiries inbox
src/routes/contact.js contact-us form
public/               pages, css/style.css, js/*.js (one script per page + shared app.js)
```

## Pages

| Page | File |
|---|---|
| Home (search, top rated) | `index.html` |
| Browse with filters | `pgs.html` |
| PG detail, reviews, enquiry | `pg.html` |
| Login / Register | `login.html`, `registration.html` |
| Forgot password / other ways / reset | `forgotPassword.html`, `otherWays.html`, `reset.html` |
| About / Contact | `aboutus.html`, `contactus.html` |
| Saved PGs | `favorites.html` |
| Owner dashboard / add PG | `dashboard.html`, `add-pg.html` |

## API summary

```
POST /api/auth/register | login | logout | forgot | reset
GET  /api/auth/me
POST /api/auth/recovery/otp | verify-otp | question | answer
GET  /api/pgs?city&q&minRent&maxRent&gender&sharing&food&verified&amenities&sort&page&limit
GET  /api/pgs/meta            GET /api/pgs/mine        GET /api/pgs/:id
POST /api/pgs                 DELETE /api/pgs/:id
POST /api/pgs/:id/reviews     POST /api/pgs/:id/enquiries
GET/POST/DELETE /api/favorites[/:pgId]
GET/PATCH /api/owner/enquiries[/:id]
POST /api/contact
```

## Notes

- **Password reset emails and OTP codes print to the server console** until you set `SMTP_*`
  in `.env` (email) and plug an SMS provider into `src/mailer.js` (`sendSms`).
- Login uses an httpOnly cookie holding a signed token. Passwords are bcrypt-hashed.
  Login, recovery and contact endpoints are rate limited.
- Owner phone numbers are only returned to logged-in users.
- Google / Facebook buttons show a "not set up" message. Real sign-in needs OAuth credentials.
- The old "Aadhaar number" recovery option was removed on purpose: storing Aadhaar numbers
  is regulated in India and is not needed here. Phone OTP and recovery question replace it.
- New listings start unverified. Set `is_verified = 1` in the `pgs` table once you have checked one.
- Behind a proxy (Render, Railway, Nginx)? Set `TRUST_PROXY=1`, `NODE_ENV=production`
  and `APP_URL` to your public address.
=======
# pg-finder
Full-stack PG (paying guest) finder: search and filter listings, reviews, favourites, owner dashboard. Node.js, Express, MySQL.
>>>>>>> 18e0d042c46b215e819e75308d284daaa7197bbd
