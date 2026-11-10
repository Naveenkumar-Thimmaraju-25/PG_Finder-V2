App.ready(async () => {
  if (!App.requireLogin(['owner', 'admin'])) return;
  const form = document.getElementById('pgForm');

  try {
    const meta = await App.api('/api/pgs/meta');
    document.getElementById('amenPick').innerHTML = meta.amenities
      .map((a) => `<label><input type="checkbox" name="amenity" value="${a.id}"> ${a.icon} ${App.esc(a.name)}</label>`)
      .join('');
  } catch (e) { /* amenities are optional */ }

  App.submit(form, async (fd) => {
    const images = String(fd.get('images') || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const d = await App.api('/api/pgs', {
      method: 'POST',
      body: {
        title: fd.get('title'), description: fd.get('description'),
        city: fd.get('city'), area: fd.get('area'), address: fd.get('address'), landmark: fd.get('landmark'),
        rent: fd.get('rent'), deposit: fd.get('deposit'), gender: fd.get('gender'), sharing: fd.get('sharing'),
        roomsAvailable: fd.get('roomsAvailable'), contactPhone: fd.get('contactPhone'),
        foodIncluded: fd.get('foodIncluded') === 'on',
        amenities: fd.getAll('amenity'), images,
      },
    });
    location.href = 'pg.html?id=' + d.id;
  });
});
