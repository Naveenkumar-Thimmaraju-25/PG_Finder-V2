App.ready(async () => {
  const form = document.getElementById('contactForm');
  if (App.user) {
    form.elements.name.value = App.user.fullName;
    form.elements.email.value = App.user.email;
  }
  App.submit(form, async (fd, f) => {
    const d = await App.api('/api/contact', {
      method: 'POST',
      body: { name: fd.get('name'), email: fd.get('email'), message: fd.get('message') },
    });
    App.formMsg(f, d.message, 'ok');
    f.elements.message.value = '';
  });
});
