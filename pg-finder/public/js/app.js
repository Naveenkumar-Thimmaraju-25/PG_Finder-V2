/* Shared helpers: API calls, navbar/footer, toasts, listing cards, favourites. */
(function () {
  const App = {};
  window.App = App;

  // ---------- small utilities ----------
  App.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  App.inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  App.qs = (sel, root) => (root || document).querySelector(sel);
  App.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  App.stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  App.date = (s) => new Date(String(s).replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ---------- API ----------
  App.api = async function (url, opts) {
    opts = opts || {};
    const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong. Please try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  };

  // ---------- toast ----------
  App.toast = function (msg, isErr) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  };

  // ---------- inline form message ----------
  App.formMsg = function (form, text, kind) {
    let el = form.querySelector('.form-msg');
    if (!el) {
      el = document.createElement('div');
      el.className = 'form-msg';
      form.insertBefore(el, form.firstChild);
    }
    el.className = 'form-msg' + (text ? ' ' + kind : '');
    el.textContent = text || '';
  };

  // Runs an async submit handler with a disabled button and error display.
  App.submit = function (form, handler) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const label = btn ? btn.textContent : '';
      App.formMsg(form, '');
      if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
      try {
        await handler(new FormData(form), form);
      } catch (err) {
        App.formMsg(form, err.message, 'err');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  };

  // ---------- current user ----------
  App.user = null;
  App.loadUser = async function () {
    try {
      const d = await App.api('/api/auth/me');
      App.user = d.user;
    } catch (e) {
      App.user = null;
    }
    return App.user;
  };

  // Redirects to login if the visitor is not signed in (optionally with a required role).
  App.requireLogin = function (roles) {
    if (!App.user) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return false;
    }
    if (roles && !roles.includes(App.user.role)) {
      location.href = '/';
      return false;
    }
    return true;
  };

  // ---------- navbar & footer ----------
  App.renderChrome = function () {
    const page = location.pathname.split('/').pop() || 'index.html';
    const link = (href, label) =>
      `<a href="${href}" class="${page === href ? 'active' : ''}">${label}</a>`;
    const u = App.user;

    let right;
    if (u) {
      right =
        (u.role !== 'tenant' ? link('dashboard.html', 'Dashboard') : '') +
        link('favorites.html', '♥ Saved') +
        `<span class="nav-user">Hi, ${App.esc(u.fullName.split(' ')[0])}</span>` +
        `<a href="#" id="logoutLink" class="btn btn-gold">Logout</a>`;
    } else {
      right = link('login.html', 'Login') + `<a href="registration.html" class="btn btn-gold">Register</a>`;
    }

    const nav = document.getElementById('site-nav');
    if (nav) {
      nav.innerHTML = `
        <nav class="nav"><div class="container nav-inner">
          <a class="brand" href="/"><img src="images/pglogo.png" alt="PG Finder"></a>
          <button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button>
          <div class="nav-links" id="navLinks">
            ${link('index.html', 'Home')}
            ${link('pgs.html', 'Browse PGs')}
            ${link('aboutus.html', 'About Us')}
            ${link('contactus.html', 'Contact')}
            ${right}
          </div>
        </div></nav>`;
      document.getElementById('navToggle').addEventListener('click', () =>
        document.getElementById('navLinks').classList.toggle('open'));
      const lo = document.getElementById('logoutLink');
      if (lo) lo.addEventListener('click', async (e) => {
        e.preventDefault();
        await App.api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        location.href = '/';
      });
    }

    const foot = document.getElementById('site-footer');
    if (foot) {
      foot.innerHTML = `
        <footer class="footer"><div class="container">
          <div class="footer-grid">
            <div><img src="images/pglogo.png" alt="PG Finder"><p>Safe, affordable PG stays,<br>without the brokerage.</p></div>
            <div><h4>Explore</h4><a href="pgs.html">Browse PGs</a><a href="aboutus.html">About Us</a><a href="contactus.html">Contact</a></div>
            <div><h4>Account</h4><a href="login.html">Login</a><a href="registration.html">Register</a><a href="forgotPassword.html">Forgot password</a></div>
          </div>
          <div class="copy">© ${new Date().getFullYear()} <span>PG Finder</span>. Made with ❤️ to help you find your perfect place.</div>
        </div></footer>`;
    }
  };

  // ---------- listing card ----------
  App.pgCard = function (p) {
    const img = p.coverImage
      ? `<img src="${App.esc(p.coverImage)}" alt="${App.esc(p.title)}" loading="lazy">`
      : '';
    const rating = p.reviewCount
      ? `<span class="rating"><i>★</i> ${p.avgRating.toFixed(1)} <small>(${p.reviewCount})</small></span>`
      : `<span class="rating"><small>No reviews yet</small></span>`;
    return `
      <article class="card">
        <div class="card-img">
          <a href="pg.html?id=${p.id}">${img}</a>
          <span class="pill">${App.esc(p.gender)}</span>
          ${p.isVerified ? '<span class="pill verified">✓ Verified</span>' : ''}
          <button class="fav ${p.isFavorite ? 'on' : ''}" data-fav="${p.id}" aria-label="Save"
            title="Save to favourites">${p.isFavorite ? '♥' : '♡'}</button>
        </div>
        <div class="card-body">
          <h3><a href="pg.html?id=${p.id}">${App.esc(p.title)}</a></h3>
          <div class="loc">📍 ${App.esc(p.area)}, ${App.esc(p.city)}</div>
          <div class="meta">
            <span class="chip">${App.esc(p.sharing)} sharing</span>
            ${p.foodIncluded ? '<span class="chip">🍽️ Meals</span>' : ''}
            <span class="chip">${p.roomsAvailable} room${p.roomsAvailable === 1 ? '' : 's'} left</span>
          </div>
          <div class="card-foot">
            <span class="price">${App.inr(p.rent)}<small> / month</small></span>
            ${rating}
          </div>
        </div>
      </article>`;
  };

  // One delegated handler makes every heart button on the page work.
  App.bindFavorites = function (root, onRemove) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-fav]');
      if (!btn) return;
      e.preventDefault();
      if (!App.user) {
        App.toast('Log in to save PGs.', true);
        setTimeout(() => (location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search)), 900);
        return;
      }
      const id = btn.dataset.fav;
      const turningOn = !btn.classList.contains('on');
      btn.disabled = true;
      try {
        await App.api('/api/favorites/' + id, { method: turningOn ? 'POST' : 'DELETE' });
        btn.classList.toggle('on', turningOn);
        btn.textContent = turningOn ? '♥' : '♡';
        if (!turningOn && onRemove) onRemove(id);
      } catch (err) {
        App.toast(err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  };

  // ---------- password show/hide ----------
  App.bindPasswordToggles = function () {
    App.qsa('[data-toggle-pw]').forEach((b) => {
      b.addEventListener('click', () => {
        const input = document.getElementById(b.dataset.togglePw);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  };

  // Only allow same-site redirects after login.
  App.safeNext = function () {
    const n = new URLSearchParams(location.search).get('next') || '';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/';
  };

  // ---------- boot ----------
  App.ready = async function (fn) {
    await App.loadUser();
    App.renderChrome();
    if (fn) await fn();
  };
})();
