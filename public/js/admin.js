(function () {
  const { el, renderMember, fitText } = window.KYF;
  const $ = (id) => document.getElementById(id);
  const form = $('addForm');
  let mode = 'poster';
  let people = [];
  const previews = {}; // field -> object URL

  async function api(url, opts = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/login') showLogin();
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  }

  // ---------- auth ----------
  function showLogin() {
    $('dashView').hidden = true;
    $('logoutBtn').hidden = true;
    $('loginView').hidden = false;
    $('username').focus();
  }
  function showDash() {
    $('loginView').hidden = true;
    $('dashView').hidden = false;
    $('logoutBtn').hidden = false;
    loadPeople();
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    $('loginMsg').textContent = '';
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('username').value, password: $('password').value }),
      });
      $('password').value = '';
      showDash();
    } catch (err) {
      $('loginMsg').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('logoutBtn').onclick = async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  };

  // ---------- form ----------
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      mode = t.dataset.mode;
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('[data-for]').forEach((s) => (s.hidden = s.dataset.for !== mode));
      renderPreview();
    })
  );

  form.querySelectorAll('.drop input').forEach((input) => {
    const drop = input.closest('.drop');
    ['dragenter', 'dragover'].forEach((ev) => input.addEventListener(ev, () => drop.classList.add('over')));
    ['dragleave', 'drop'].forEach((ev) => input.addEventListener(ev, () => drop.classList.remove('over')));
    input.addEventListener('change', () => {
      const file = input.files[0];
      const thumb = drop.querySelector('.thumb');
      if (previews[input.name]) URL.revokeObjectURL(previews[input.name]);
      previews[input.name] = file ? URL.createObjectURL(file) : null;
      thumb.style.backgroundImage = file ? `url("${previews[input.name]}")` : '';
      thumb.classList.toggle('has', Boolean(file));
      drop.querySelector('.t').firstChild.textContent = file ? file.name : drop.dataset.label;
      renderPreview();
    });
    drop.dataset.label = drop.querySelector('.t').firstChild.textContent;
  });
  ['name', 'role', 'intro'].forEach((id) => $(id).addEventListener('input', renderPreview));

  function draft() {
    return {
      name: $('name').value.trim() || 'Your Name',
      role: $('role').value.trim(),
      type: mode,
      image: previews.poster,
      photo: previews.photo,
      familyPhoto: previews.familyPhoto,
      intro: $('intro').value.trim(),
    };
  }

  function renderPreview() {
    const box = $('preview');
    const d = draft();
    const ready = mode === 'poster' ? d.image : d.photo || d.intro || $('name').value;
    box.innerHTML = '';
    if (!ready) {
      box.innerHTML = '<div class="empty">Your page will appear here<br>as you fill in the details.</div>';
      return;
    }
    if (mode === 'profile' && !d.intro) d.intro = 'Their introduction will appear here…';
    const inner = el('div', 'page-inner');
    inner.append(renderMember(d));
    box.append(inner);
    requestAnimationFrame(() => fitText(inner.querySelector('.mp-intro')));
  }

  // Downscale big photos in the browser so uploads stay small and the booklet stays fast.
  async function shrink(file, maxSide = 2000) {
    if (!file) return null;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
      return file;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('addMsg');
    msg.className = 'msg';
    const file = (n) => form.querySelector(`input[name="${n}"]`).files[0];

    if (!$('name').value.trim()) return (msg.textContent = 'Please enter their name.');
    if (mode === 'poster' && !file('poster')) return (msg.textContent = 'Please choose the poster image.');
    if (mode === 'profile' && (!file('photo') || !$('intro').value.trim()))
      return (msg.textContent = 'Please add their photo and an introduction.');

    const btn = $('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Adding…';
    msg.textContent = '';
    try {
      const fd = new FormData();
      fd.append('type', mode);
      fd.append('name', $('name').value.trim());
      fd.append('role', $('role').value.trim());
      if (mode === 'poster') {
        fd.append('poster', await shrink(file('poster'), 2400));
      } else {
        fd.append('intro', $('intro').value.trim());
        fd.append('photo', await shrink(file('photo')));
        if (file('familyPhoto')) fd.append('familyPhoto', await shrink(file('familyPhoto')));
      }
      const entry = await api('/api/finprovians', { method: 'POST', body: fd });
      msg.className = 'msg ok';
      msg.textContent = `${entry.name} has been added to the booklet.`;
      resetForm();
      loadPeople();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add to booklet';
    }
  });

  function resetForm() {
    form.reset();
    form.querySelectorAll('.drop input').forEach((i) => i.dispatchEvent(new Event('change')));
    renderPreview();
  }

  // ---------- list ----------
  async function loadPeople() {
    people = await api('/api/finprovians');
    renderList();
  }

  function renderList() {
    const ul = $('people');
    ul.innerHTML = '';
    people.forEach((p, i) => {
      const li = el('li', 'person');
      li.append(el('span', 'no', String(i + 1)));
      const ph = el('div', 'ph');
      if (p.type === 'poster') ph.style.backgroundImage = `url("${p.image}")`;
      else {
        const inner = el('div', 'page-inner');
        inner.append(renderMember(p));
        ph.append(inner);
        requestAnimationFrame(() => fitText(inner.querySelector('.mp-intro')));
      }
      const meta = el('div', 'meta');
      meta.append(el('b', null, p.name), el('small', null, p.role || (p.type === 'poster' ? 'Poster' : 'Built page')));
      const tools = el('div', 'tools');
      const up = el('button', null, '↑');
      const down = el('button', null, '↓');
      const del = el('button', 'del', 'Remove');
      del.title = `Remove ${p.name} from the booklet`;
      up.title = 'Move earlier';
      down.title = 'Move later';
      up.disabled = i === 0;
      down.disabled = i === people.length - 1;
      up.onclick = () => move(i, -1);
      down.onclick = () => move(i, 1);
      del.onclick = () => remove(p);
      tools.append(up, down, del);
      meta.append(tools);
      li.append(ph, meta);
      li.dataset.name = p.name.toLowerCase();
      ul.append(li);
    });
    applySearch();
  }

  function applySearch() {
    const q = $('search').value.trim().toLowerCase();
    let shown = 0;
    $('people').querySelectorAll('.person').forEach((li) => {
      const match = !q || li.dataset.name.includes(q);
      li.hidden = !match;
      if (match) shown++;
    });
    $('count').textContent = q
      ? `${shown} of ${people.length} shown`
      : `${people.length} finprovian${people.length === 1 ? '' : 's'}`;
  }
  $('search').addEventListener('input', applySearch);

  async function move(i, d) {
    const next = people.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    try {
      await api('/api/finprovians/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
      people = next;
      renderList();
    } catch (err) {
      alert(err.message);
      loadPeople();
    }
  }

  async function remove(p) {
    if (!confirm(`Remove ${p.name} from the booklet? This can't be undone.`)) return;
    try {
      await api('/api/finprovians/' + encodeURIComponent(p.id), { method: 'DELETE' });
      loadPeople();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- boot ----------
  api('/api/me')
    .then((me) => (me.hr ? showDash() : showLogin()))
    .catch(showLogin);
})();
