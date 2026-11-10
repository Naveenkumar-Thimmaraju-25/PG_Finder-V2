App.ready(async () => {
  if (!App.requireLogin(['owner', 'admin'])) return;
  const $ = (id) => document.getElementById(id);

  // ----- tabs -----
  App.qsa('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      App.qsa('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('listings').style.display = b.dataset.tab === 'listings' ? '' : 'none';
      $('enquiries').style.display = b.dataset.tab === 'enquiries' ? '' : 'none';
    }));

  // ----- listings -----
  async function loadListings() {
    try {
      const d = await App.api('/api/pgs/mine');
      if (!d.results.length) {
        $('listings').innerHTML = '<div class="empty"><h3>No listings yet</h3><p><a href="add-pg.html">Add your first PG</a></p></div>';
        return;
      }
      $('listings').innerHTML = `<table>
        <thead><tr><th>PG</th><th>Location</th><th>Rent</th><th>Rooms</th><th>Enquiries</th><th></th></tr></thead>
        <tbody>${d.results.map((p) => `
          <tr>
            <td><a href="pg.html?id=${p.id}"><strong>${App.esc(p.title)}</strong></a>${p.isVerified ? '' : '<br><small class="loc">Pending verification</small>'}</td>
            <td>${App.esc(p.area)}, ${App.esc(p.city)}</td>
            <td>${App.inr(p.rent)}</td>
            <td>${p.roomsAvailable}</td>
            <td>${p.enquiryCount}</td>
            <td><button class="btn btn-danger btn-sm" data-del="${p.id}" data-title="${App.esc(p.title)}">Delete</button></td>
          </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      $('listings').innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
    }
  }

  $('listings').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!confirm(`Delete "${b.dataset.title}"? This also removes its photos, reviews and enquiries.`)) return;
    b.disabled = true;
    try {
      await App.api('/api/pgs/' + b.dataset.del, { method: 'DELETE' });
      App.toast('Listing deleted.');
      loadListings();
    } catch (err) {
      App.toast(err.message, true);
      b.disabled = false;
    }
  });

  // ----- enquiries -----
  async function loadEnquiries() {
    try {
      const d = await App.api('/api/owner/enquiries');
      const fresh = d.results.filter((x) => x.status === 'new').length;
      $('newCount').textContent = fresh ? `(${fresh} new)` : '';
      if (!d.results.length) {
        $('enquiries').innerHTML = '<div class="empty"><h3>No enquiries yet</h3><p>They will show up here when tenants contact you.</p></div>';
        return;
      }
      $('enquiries').innerHTML = `<table>
        <thead><tr><th>From</th><th>PG</th><th>Message</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>${d.results.map((q) => `
          <tr>
            <td><strong>${App.esc(q.name)}</strong><br><a href="mailto:${App.esc(q.email)}">${App.esc(q.email)}</a>
              ${q.phone ? `<br><a href="tel:+91${App.esc(q.phone)}">+91 ${App.esc(q.phone)}</a>` : ''}</td>
            <td><a href="pg.html?id=${q.pgId}">${App.esc(q.pgTitle)}</a></td>
            <td style="max-width:320px">${App.esc(q.message)}${q.moveIn ? `<br><small class="loc">Move-in: ${App.esc(q.moveIn)}</small>` : ''}</td>
            <td>${App.date(q.createdAt)}</td>
            <td><select data-enq="${q.id}" aria-label="Status">
              ${['new', 'contacted', 'closed'].map((s) => `<option value="${s}" ${q.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></td>
          </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      $('enquiries').innerHTML = `<div class="empty">${App.esc(e.message)}</div>`;
    }
  }

  $('enquiries').addEventListener('change', async (e) => {
    const s = e.target.closest('[data-enq]');
    if (!s) return;
    try {
      await App.api('/api/owner/enquiries/' + s.dataset.enq, { method: 'PATCH', body: { status: s.value } });
      App.toast('Status updated.');
      loadEnquiries();
    } catch (err) {
      App.toast(err.message, true);
    }
  });

  loadListings();
  loadEnquiries();
});
