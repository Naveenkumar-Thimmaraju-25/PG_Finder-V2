/* Login, register, forgot password, other ways and reset: one script, each part runs if its form exists. */
App.ready(async () => {
  const $ = (id) => document.getElementById(id);
  App.bindPasswordToggles();

  // Signed-in visitors do not need the login / register pages.
  if (App.user && ($('loginForm') || $('registerForm'))) {
    location.replace('/');
    return;
  }

  // ---------------------------------------------------------------- login
  const login = $('loginForm');
  if (login) {
    App.submit(login, async (fd) => {
      await App.api('/api/auth/login', {
        method: 'POST',
        body: { identifier: fd.get('identifier'), password: fd.get('password'), remember: fd.get('remember') === 'on' },
      });
      location.href = App.safeNext();
    });
    App.qsa('[data-social]').forEach((b) =>
      b.addEventListener('click', () =>
        App.toast(`${b.dataset.social} sign-in is not set up yet. Please use your username and password.`, true)));
  }

  // ------------------------------------------------------------- register
  const reg = $('registerForm');
  if (reg) {
    App.submit(reg, async (fd) => {
      if (fd.get('password') !== fd.get('confirmPassword')) throw new Error('Passwords do not match.');
      await App.api('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: fd.get('fullName'), email: fd.get('email'), username: fd.get('username'),
          phone: fd.get('phone'), role: fd.get('role'), password: fd.get('password'),
          confirmPassword: fd.get('confirmPassword'),
          recoveryQuestion: fd.get('recoveryQuestion'), recoveryAnswer: fd.get('recoveryAnswer'),
        },
      });
      location.href = fd.get('role') === 'owner' ? '/add-pg.html' : '/pgs.html';
    });
  }

  // ------------------------------------------------------ forgot password
  const forgot = $('forgotForm');
  if (forgot) {
    App.submit(forgot, async (fd, form) => {
      const d = await App.api('/api/auth/forgot', { method: 'POST', body: { email: fd.get('email') } });
      App.formMsg(form, d.message, 'ok');
    });
  }

  // ----------------------------------------------------------- other ways
  if ($('otherWays')) {
    const setMsg = (id, text, kind) => {
      const el = $(id);
      el.className = 'form-msg' + (text ? ' ' + kind : '');
      el.textContent = text || '';
    };
    const busy = async (btn, fn) => {
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Please wait...';
      try { await fn(); } finally { btn.disabled = false; btn.textContent = label; }
    };
    const goReset = (token) => { location.href = 'reset.html?token=' + encodeURIComponent(token); };

    // open the chosen method
    App.qsa('input[name=method]').forEach((r) =>
      r.addEventListener('change', () => {
        $('mPhone').classList.toggle('open', r.value === 'phone' && r.checked);
        $('mQuestion').classList.toggle('open', r.value === 'question' && r.checked);
      }));

    $('sendOtp').addEventListener('click', (e) => busy(e.target, async () => {
      setMsg('msgPhone', '');
      try {
        const d = await App.api('/api/auth/recovery/otp', { method: 'POST', body: { phone: $('phoneNum').value } });
        setMsg('msgPhone', d.message, 'ok');
        $('otpStep').style.display = 'block';
      } catch (err) { setMsg('msgPhone', err.message, 'err'); }
    }));

    $('verifyOtp').addEventListener('click', (e) => busy(e.target, async () => {
      setMsg('msgPhone', '');
      try {
        const d = await App.api('/api/auth/recovery/verify-otp', {
          method: 'POST', body: { phone: $('phoneNum').value, otp: $('otpCode').value },
        });
        goReset(d.resetToken);
      } catch (err) { setMsg('msgPhone', err.message, 'err'); }
    }));

    $('showQ').addEventListener('click', (e) => busy(e.target, async () => {
      setMsg('msgQuestion', '');
      try {
        const d = await App.api('/api/auth/recovery/question', { method: 'POST', body: { username: $('qUser').value } });
        $('qText').textContent = d.question;
        $('qStep').style.display = 'block';
      } catch (err) { setMsg('msgQuestion', err.message, 'err'); }
    }));

    $('verifyQ').addEventListener('click', (e) => busy(e.target, async () => {
      setMsg('msgQuestion', '');
      try {
        const d = await App.api('/api/auth/recovery/answer', {
          method: 'POST', body: { username: $('qUser').value, answer: $('qAnswer').value },
        });
        goReset(d.resetToken);
      } catch (err) { setMsg('msgQuestion', err.message, 'err'); }
    }));
  }

  // ---------------------------------------------------------------- reset
  const reset = $('resetForm');
  if (reset) {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (!token) App.formMsg(reset, 'This reset link is missing its token. Please request a new one.', 'err');
    App.submit(reset, async (fd, form) => {
      if (!token) throw new Error('This reset link is missing its token. Please request a new one.');
      if (fd.get('password') !== fd.get('confirmPassword')) throw new Error('Passwords do not match.');
      const d = await App.api('/api/auth/reset', { method: 'POST', body: { token, password: fd.get('password') } });
      App.formMsg(form, d.message, 'ok');
      setTimeout(() => (location.href = 'login.html'), 1800);
    });
  }
});
