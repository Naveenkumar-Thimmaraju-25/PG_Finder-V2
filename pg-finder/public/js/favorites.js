App.ready(async () => {
  if (!App.requireLogin()) return;
  const list = document.getElementById('list');
  const emptyHtml = '<div class="empty"><h3>Nothing saved yet</h3><p>Tap the ♡ on any PG to add it here. <a href="pgs.html">Browse PGs</a></p></div>';

  App.bindFavorites(list, (id) => {
    const btn = list.querySelector(`[data-fav="${id}"]`);
    if (btn) btn.closest('.card').remove();
    if (!list.querySelector('.card')) list.innerHTML = emptyHtml;
  });

  try {
    const d = await App.api('/api/favorites');
    list.innerHTML = d.results.length ? d.results.map(App.pgCard).join('') : emptyHtml;
  } catch (e) {
    list.innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
  }
});
