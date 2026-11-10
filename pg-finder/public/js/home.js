App.ready(async () => {
  const featured = document.getElementById('featured');
  featured.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  App.bindFavorites(featured);

  // City dropdown and live numbers
  try {
    const meta = await App.api('/api/pgs/meta');
    const sel = document.getElementById('sCity');
    meta.cities.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.city;
      o.textContent = `${c.city} (${c.count})`;
      sel.appendChild(o);
    });
    document.getElementById('stListings').textContent = meta.stats.listings.toLocaleString('en-IN');
    document.getElementById('stCities').textContent = meta.stats.cities;
    document.getElementById('stMembers').textContent = meta.stats.members.toLocaleString('en-IN');
  } catch (e) { /* page still works without them */ }

  // Top-rated listings
  try {
    const data = await App.api('/api/pgs?sort=rating&limit=6');
    featured.innerHTML = data.results.length
      ? data.results.map(App.pgCard).join('')
      : '<div class="empty">No listings yet. Check back soon!</div>';
  } catch (e) {
    featured.innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
  }

  // Hero search sends the visitor to the browse page with filters applied
  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    const city = document.getElementById('sCity').value;
    const q = document.getElementById('sQuery').value.trim();
    const budget = document.getElementById('sBudget').value;
    if (city) p.set('city', city);
    if (q) p.set('q', q);
    if (budget) p.set('maxRent', budget);
    location.href = 'pgs.html' + (p.toString() ? '?' + p : '');
  });
});
