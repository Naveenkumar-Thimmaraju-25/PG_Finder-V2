App.ready(async () => {
  const $ = (id) => document.getElementById(id);
  const results = $('results');
  const params = new URLSearchParams(location.search);
  let page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  let timer = null;

  App.bindFavorites(results);

  // ----- build filter controls from the database -----
  try {
    const meta = await App.api('/api/pgs/meta');
    meta.cities.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.city;
      o.textContent = `${c.city} (${c.count})`;
      $('fCity').appendChild(o);
    });
    $('fAmenities').innerHTML = meta.amenities
      .map((a) => `<label><input type="checkbox" value="${a.id}"> ${a.icon} ${App.esc(a.name)}</label>`)
      .join('');
  } catch (e) { /* filters still work without options */ }

  // ----- restore filters from the address bar -----
  $('fQ').value = params.get('q') || '';
  $('fCity').value = params.get('city') || '';
  $('fMin').value = params.get('minRent') || '';
  $('fMax').value = params.get('maxRent') || '';
  $('fGender').value = params.get('gender') || '';
  $('fSort').value = params.get('sort') || 'newest';
  $('fFood').checked = params.get('food') === '1';
  $('fVerified').checked = params.get('verified') === '1';
  const sharing = (params.get('sharing') || '').split(',');
  App.qsa('#fSharing input').forEach((c) => (c.checked = sharing.includes(c.value)));
  const amen = (params.get('amenities') || '').split(',');
  App.qsa('#fAmenities input').forEach((c) => (c.checked = amen.includes(c.value)));

  function checked(sel) {
    return App.qsa(sel + ' input:checked').map((c) => c.value).join(',');
  }

  function currentQuery() {
    const p = new URLSearchParams();
    const add = (k, v) => { if (v) p.set(k, v); };
    add('q', $('fQ').value.trim());
    add('city', $('fCity').value);
    add('minRent', $('fMin').value);
    add('maxRent', $('fMax').value);
    add('gender', $('fGender').value);
    add('sharing', checked('#fSharing'));
    add('amenities', checked('#fAmenities'));
    if ($('fFood').checked) p.set('food', '1');
    if ($('fVerified').checked) p.set('verified', '1');
    if ($('fSort').value !== 'newest') p.set('sort', $('fSort').value);
    return p;
  }

  async function load() {
    const p = currentQuery();
    if (page > 1) p.set('page', page);
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
    p.set('limit', '8');
    p.set('page', page);

    results.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const data = await App.api('/api/pgs?' + p);
      $('count').textContent = data.total === 1 ? '1 PG found' : `${data.total} PGs found`;
      results.innerHTML = data.results.length
        ? data.results.map(App.pgCard).join('')
        : '<div class="empty"><h3>No PGs match these filters</h3><p>Try widening your budget or clearing a filter.</p></div>';
      renderPager(data.page, data.pages);
    } catch (e) {
      $('count').textContent = '';
      results.innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
      $('pager').innerHTML = '';
    }
  }

  function renderPager(cur, total) {
    const el = $('pager');
    if (total <= 1) { el.innerHTML = ''; return; }
    let html = `<button data-p="${cur - 1}" ${cur === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - cur) <= 1) {
        html += `<button data-p="${i}" class="${i === cur ? 'on' : ''}">${i}</button>`;
      } else if (Math.abs(i - cur) === 2) {
        html += '<button disabled>…</button>';
      }
    }
    html += `<button data-p="${cur + 1}" ${cur === total ? 'disabled' : ''}>›</button>`;
    el.innerHTML = html;
  }

  $('pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b || b.disabled) return;
    page = Number(b.dataset.p);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Any filter change reloads from page 1 (text inputs wait until typing pauses).
  function changed(delay) {
    clearTimeout(timer);
    timer = setTimeout(() => { page = 1; load(); }, delay);
  }
  ['fQ', 'fMin', 'fMax'].forEach((id) => $(id).addEventListener('input', () => changed(450)));
  ['fCity', 'fGender', 'fSort', 'fFood', 'fVerified'].forEach((id) => $(id).addEventListener('change', () => changed(0)));
  $('fSharing').addEventListener('change', () => changed(0));
  $('fAmenities').addEventListener('change', () => changed(0));

  $('clearBtn').addEventListener('click', () => {
    $('fQ').value = ''; $('fCity').value = ''; $('fMin').value = ''; $('fMax').value = '';
    $('fGender').value = ''; $('fSort').value = 'newest';
    $('fFood').checked = false; $('fVerified').checked = false;
    App.qsa('#fSharing input, #fAmenities input').forEach((c) => (c.checked = false));
    changed(0);
  });

  $('filterToggle').addEventListener('click', () => $('filters').classList.toggle('open'));

  load();
});
