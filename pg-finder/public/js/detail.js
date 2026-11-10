App.ready(async () => {
  const page = document.getElementById('page');
  const id = parseInt(new URLSearchParams(location.search).get('id'), 10);

  if (!id) {
    page.innerHTML = '<div class="empty"><h2>PG not found</h2><p><a href="pgs.html">Browse all PGs</a></p></div>';
    return;
  }

  async function load() {
    let pg;
    try {
      pg = await App.api('/api/pgs/' + id);
    } catch (e) {
      page.innerHTML = `<div class="empty"><h2>PG not found</h2><p>${App.esc(e.message)}</p><p><a href="pgs.html">Browse all PGs</a></p></div>`;
      return;
    }
    render(pg);
  }

  function render(pg) {
    document.title = pg.title + ' - PG Finder';
    const u = App.user;
    const images = pg.images.length ? pg.images : [];
    const hero = images[0] ? `<img id="mainImg" src="${App.esc(images[0])}" alt="${App.esc(pg.title)}">` : '';
    const thumbs = images.length > 1
      ? `<div class="thumbs">${images.map((src, i) =>
          `<button type="button" class="${i === 0 ? 'on' : ''}" data-src="${App.esc(src)}"><img src="${App.esc(src)}" alt="Photo ${i + 1}"></button>`).join('')}</div>`
      : '';

    const amenities = pg.amenities.length
      ? `<div class="amen-grid">${pg.amenities.map((a) => `<div class="amen">${a.icon} ${App.esc(a.name)}</div>`).join('')}</div>`
      : '<p class="loc">The owner has not listed amenities yet.</p>';

    const reviews = pg.reviews.length
      ? pg.reviews.map((r) => `
          <div class="review">
            <div class="who"><span>${App.esc(r.name)}</span><span class="when">${App.date(r.createdAt)}</span></div>
            <div class="stars">${App.stars(r.rating)}</div>
            ${r.comment ? `<p>${App.esc(r.comment)}</p>` : ''}
          </div>`).join('')
      : '<p class="loc">No reviews yet. Be the first to share your experience.</p>';

    let reviewForm;
    if (pg.isOwner) reviewForm = '';
    else if (!u) reviewForm = `<p style="margin-top:18px"><a href="login.html?next=${encodeURIComponent(location.pathname + location.search)}">Log in</a> to write a review.</p>`;
    else reviewForm = `
      <form id="reviewForm" style="margin-top:22px">
        <h3 style="font-size:19px;margin-bottom:10px">Write a review</h3>
        <div class="field">
          <div class="star-input">
            ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="rt${n}" value="${n}"><label for="rt${n}" title="${n} star${n > 1 ? 's' : ''}">★</label>`).join('')}
          </div>
        </div>
        <div class="field"><textarea name="comment" maxlength="1000" placeholder="What was it like to stay here?"></textarea></div>
        <button class="btn btn-navy" type="submit">Post review</button>
      </form>`;

    const phone = pg.contactPhone
      ? `<div class="phone-box">📞 <a href="tel:+91${App.esc(pg.contactPhone)}">+91 ${App.esc(pg.contactPhone)}</a></div>`
      : (u ? '' : `<div class="phone-box"><a href="login.html?next=${encodeURIComponent(location.pathname + location.search)}">Log in</a> to see the owner's phone number.</div>`);

    const rating = pg.reviewCount
      ? `<span class="stars">${App.stars(pg.avgRating)}</span> <strong>${pg.avgRating.toFixed(1)}</strong> <span class="loc">(${pg.reviewCount} review${pg.reviewCount === 1 ? '' : 's'})</span>`
      : '<span class="loc">No reviews yet</span>';

    page.innerHTML = `
      <div class="detail">
        <div>
          <div class="gallery">
            <div class="main">${hero}</div>
            ${thumbs}
          </div>

          <div class="panel">
            <h1 style="font-size:32px;margin-bottom:6px">${App.esc(pg.title)}</h1>
            <div class="loc">📍 ${App.esc(pg.address ? pg.address + ', ' : '')}${App.esc(pg.area)}, ${App.esc(pg.city)}${pg.landmark ? ' · ' + App.esc(pg.landmark) : ''}</div>
            <div style="margin-top:10px">${rating}${pg.isVerified ? ' &nbsp;<span class="chip" style="background:#e6f6ee;color:#1e8e5a">✓ Verified</span>' : ''}</div>
            ${pg.description ? `<p style="margin-top:16px">${App.esc(pg.description).replace(/\n/g, '<br>')}</p>` : ''}
          </div>

          <div class="panel"><h2>Amenities</h2>${amenities}</div>

          <div class="panel"><h2>Reviews</h2>${reviews}${reviewForm}</div>
        </div>

        <aside class="side">
          <div class="panel">
            <div class="big-price">${App.inr(pg.rent)}<small style="font:400 14px 'DM Sans';color:var(--muted)"> / month</small></div>
            <ul class="facts">
              <li><span>Deposit</span><b>${App.inr(pg.deposit)}</b></li>
              <li><span>For</span><b>${App.esc(pg.gender === 'unisex' ? 'Men & Women' : pg.gender)}</b></li>
              <li><span>Sharing</span><b>${App.esc(pg.sharing)}</b></li>
              <li><span>Meals</span><b>${pg.foodIncluded ? 'Included' : 'Not included'}</b></li>
              <li><span>Rooms left</span><b>${pg.roomsAvailable}</b></li>
              <li><span>Listed by</span><b>${App.esc(pg.ownerName)}</b></li>
            </ul>
            <button class="btn btn-ghost btn-block" id="favBtn" type="button" data-on="${pg.isFavorite ? '1' : '0'}">${pg.isFavorite ? '♥ Saved' : '♡ Save this PG'}</button>
            ${phone}
          </div>

          ${pg.isOwner ? '<div class="panel"><p>This is your listing. Enquiries appear on your <a href="dashboard.html">dashboard</a>.</p></div>' : `
          <div class="panel">
            <h2 style="font-size:21px">Send an enquiry</h2>
            <form id="enquiryForm">
              <div class="field"><label for="eName">Your name</label><input id="eName" name="name" required maxlength="100" value="${App.esc(u ? u.fullName : '')}"></div>
              <div class="field"><label for="eEmail">Email</label><input id="eEmail" name="email" type="email" required value="${App.esc(u ? u.email : '')}"></div>
              <div class="field"><label for="ePhone">Mobile (optional)</label><input id="ePhone" name="phone" type="tel" maxlength="15" placeholder="10-digit number"></div>
              <div class="field"><label for="eMove">Planned move-in (optional)</label><input id="eMove" name="moveIn" type="date"></div>
              <div class="field"><label for="eMsg">Message</label><textarea id="eMsg" name="message" required minlength="5" maxlength="1000">Hi, I'm interested in this PG. Is it still available?</textarea></div>
              <button class="btn btn-gold btn-block" type="submit">Send enquiry</button>
            </form>
          </div>`}
        </aside>
      </div>`;

    // gallery thumbnails
    App.qsa('.thumbs button', page).forEach((b) =>
      b.addEventListener('click', () => {
        document.getElementById('mainImg').src = b.dataset.src;
        App.qsa('.thumbs button', page).forEach((x) => x.classList.toggle('on', x === b));
      }));

    const favBtn = document.getElementById('favBtn');
    favBtn.addEventListener('click', async () => {
      if (!App.user) {
        App.toast('Log in to save PGs.', true);
        setTimeout(() => (location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search)), 900);
        return;
      }
      const turningOn = favBtn.dataset.on !== '1';
      favBtn.disabled = true;
      try {
        await App.api('/api/favorites/' + id, { method: turningOn ? 'POST' : 'DELETE' });
        favBtn.dataset.on = turningOn ? '1' : '0';
        favBtn.textContent = turningOn ? '♥ Saved' : '♡ Save this PG';
      } catch (err) {
        App.toast(err.message, true);
      } finally {
        favBtn.disabled = false;
      }
    });

    const enq = document.getElementById('enquiryForm');
    if (enq) {
      App.submit(enq, async (fd, form) => {
        const d = await App.api(`/api/pgs/${id}/enquiries`, {
          method: 'POST',
          body: {
            name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
            moveIn: fd.get('moveIn'), message: fd.get('message'),
          },
        });
        App.formMsg(form, d.message, 'ok');
        form.querySelector('textarea').value = '';
      });
    }

    const rev = document.getElementById('reviewForm');
    if (rev) {
      App.submit(rev, async (fd) => {
        if (!fd.get('rating')) throw new Error('Choose a star rating first.');
        await App.api(`/api/pgs/${id}/reviews`, { method: 'POST', body: { rating: fd.get('rating'), comment: fd.get('comment') } });
        App.toast('Thanks for your review!');
        await load();
      });
    }
  }

  load();
});
