(async function () {
  const { el, renderMember, fitText } = window.KYF;
  const TOC_PER_PAGE = 13;

  const $ = (id) => document.getElementById(id);
  const bookEl = $('book');
  const shell = $('bookShell');

  let people = [];
  try {
    people = await (await fetch('/api/finprovians')).json();
  } catch (e) {
    $('loader').textContent = 'Could not load the booklet. Please refresh.';
    return;
  }

  // ---------- page plan ----------
  const tocPages = Math.max(1, Math.ceil(people.length / TOC_PER_PAGE));
  const firstMember = 2 + tocPages; // cover, welcome, then contents
  const plan = [{ kind: 'cover' }, { kind: 'welcome' }];
  for (let t = 0; t < tocPages; t++) plan.push({ kind: 'toc', part: t });
  people.forEach((p) => plan.push({ kind: 'member', person: p }));
  plan.push({ kind: 'closing' });

  // Contents lists names alphabetically; each still points at its real page
  const tocEntries = people
    .map((p, i) => ({ name: p.name, pageNo: firstMember + i }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  plan.push({ kind: 'back' });

  // ---------- page builders ----------
  function buildContent(def, index) {
    switch (def.kind) {
      case 'cover': {
        // The designed cover artwork (public/img/cover.jpg)
        const c = el('div', 'cover-image');
        c.innerHTML = `<img src="/img/cover.jpg" alt="Know Your Finprovian — faces, families &amp; stories of our newest members" draggable="false">`;
        return c;
      }
      case 'welcome': {
        const c = el('div', 'paper welcome');
        c.innerHTML = `
          <p class="eyebrow">A note before you begin</p>
          <h2>Welcome to the family</h2>
          <div class="rule"></div>
          <p class="lead">Every person in these pages brought something new through our doors — a story, a hometown, a family cheering them on, and a little curiosity about what comes next.</p>
          <p>This booklet is our way of saying hello properly. Turn the pages, put a face to a name, and the next time you pass one of them in the corridor, you'll already know where to start the conversation.</p>
          <p class="signoff">With warmth,<br><span>Team HR, Finprov</span></p>`;
        c.append(folio(index));
        return c;
      }
      case 'toc': {
        const c = el('div', 'paper toc');
        c.append(el('p', 'eyebrow', def.part === 0 ? 'Inside this booklet' : 'Contents, continued'));
        c.append(el('h2', null, 'Contents'));
        c.append(el('div', 'rule'));
        const list = el('ol', 'toc-list');
        list.start = def.part * TOC_PER_PAGE + 1;
        tocEntries.slice(def.part * TOC_PER_PAGE, (def.part + 1) * TOC_PER_PAGE).forEach(({ name, pageNo }) => {
          const li = el('li');
          const a = el('a');
          a.href = '#p' + pageNo;
          a.dataset.page = pageNo;
          a.innerHTML = '<span class="n"></span><span class="dots"></span><span class="pg"></span>';
          a.querySelector('.n').textContent = name;
          a.querySelector('.pg').textContent = pageNo;
          li.append(a);
          list.append(li);
        });
        c.append(list);
        c.append(folio(index));
        return c;
      }
      case 'member':
        return renderMember(def.person);
      case 'closing': {
        const c = el('div', 'paper closing');
        c.innerHTML = `
          <h2>Glad you're here!</h2>
          <p>Say hello, share a coffee, and help them feel at home.<br>Every great team is built one introduction at a time.</p>
          <p class="closing-script">— the Finprov family</p>`;
        return c;
      }
      case 'back': {
        const c = el('div', 'cover back');
        c.innerHTML = `
          <div class="back-mid">
            <img class="cover-logo" src="/img/finprov-logo.png" alt="Finprov" draggable="false">
            <p class="back-tag">Skill up · Rise up</p>
          </div>
          <p class="back-foot">www.finprov.com</p>`;
        return c;
      }
    }
  }

  function folio(n) {
    return el('span', 'folio', String(n));
  }

  plan.forEach((def, i) => {
    const page = el('div', 'page');
    if (def.kind === 'cover' || def.kind === 'back') page.dataset.density = 'hard';
    const inner = el('div', 'page-inner');
    inner.append(buildContent(def, i));
    page.append(inner);
    bookEl.append(page);
  });

  // Let all fonts land before measuring anything
  try { await document.fonts.ready; } catch (e) {}

  // ---------- flipbook ----------
  const pageFlip = new St.PageFlip(bookEl, {
    width: 560,
    height: 792, // A-series ratio, matches the posters
    size: 'stretch',
    // The library shows a single page whenever the box is narrower than 2 × minWidth,
    // so a huge minWidth keeps it one-page-at-a-time on every screen
    // (the min-width it puts on the container is overridden in CSS).
    minWidth: 100000,
    maxWidth: 200000,
    minHeight: 300,
    maxHeight: 2000,
    showCover: true,
    usePortrait: true,
    autoSize: false, // .book-shell sets the box; the book fits inside it on both axes
    mobileScrollSupport: false,
    maxShadowOpacity: 0.45,
    flippingTime: 900,
    swipeDistance: 24,
    showPageCorners: true,
    disableFlipByClick: false,
  });
  pageFlip.loadFromHTML(bookEl.querySelectorAll('.page'));
  const total = pageFlip.getPageCount();

  $('loader').remove();
  shell.classList.add('ready');

  // Fit long introductions on built pages (done once; sizes are in cqw so they scale)
  function fitVisible() {
    bookEl.querySelectorAll('.mp-intro:not([data-fit])').forEach((n) => {
      if (fitText(n)) n.dataset.fit = '1';
    });
  }

  function label(i) {
    const def = plan[i];
    if (!def) return '';
    return { cover: 'Cover', welcome: 'Welcome', toc: 'Contents', closing: 'Glad you’re here', back: 'Back cover' }[def.kind] ?? def.person.name;
  }

  function updateStatus() {
    const idx = pageFlip.getCurrentPageIndex();
    $('statusName').textContent = label(idx) || '—';
    $('statusPage').textContent = idx === 0 ? `${people.length} finprovians` : `Page ${idx} of ${total - 1}`;
    $('prevBtn').disabled = idx === 0;
    $('nextBtn').disabled = idx >= total - 1;
    history.replaceState(null, '', idx ? '#p' + idx : location.pathname);
  }

  pageFlip.on('flip', () => {
    updateStatus();
    fitVisible();
  });
  // Deep link (#p12)
  const start = parseInt((location.hash.match(/^#p(\d+)$/) || [])[1], 10);
  if (start > 0 && start < total) pageFlip.turnToPage(start);
  updateStatus();
  // page sizes are only known after the first layout pass
  requestAnimationFrame(() => requestAnimationFrame(fitVisible));

  // ---------- controls ----------
  $('prevBtn').onclick = () => pageFlip.flipPrev();
  $('nextBtn').onclick = () => pageFlip.flipNext();
  $('tocBtn').onclick = () => pageFlip.flip(2);
  bookEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    pageFlip.flip(Number(a.dataset.page));
  });

  document.addEventListener('keydown', (e) => {
    if (!$('lightbox').hidden) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') lbGo(1);
      if (e.key === 'ArrowLeft') lbGo(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') pageFlip.flipNext();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') pageFlip.flipPrev();
    if (e.key === 'Home') pageFlip.flip(0);
    if (e.key === 'End') pageFlip.flip(total - 1);
  });

  // ---------- lightbox (read a page larger) ----------
  let lbIndex = 0;
  const lb = $('lightbox');
  const frame = $('lbFrame');

  function lbRender(dir = 1) {
    frame.innerHTML = '';
    const inner = el('div', 'page-inner');
    inner.append(buildContent(plan[lbIndex], lbIndex));
    frame.append(inner);
    frame.classList.remove('turn', 'back');
    void frame.offsetWidth;
    frame.classList.add('turn');
    frame.classList.toggle('back', dir < 0);
    requestAnimationFrame(() => fitText(inner.querySelector('.mp-intro')));
    $('lbPrev').disabled = lbIndex <= 0;
    $('lbNext').disabled = lbIndex >= total - 1;
  }
  function lbGo(d) {
    const n = lbIndex + d;
    if (n < 0 || n >= total) return;
    lbIndex = n;
    lbRender(d);
  }
  function openLightbox(i) {
    lbIndex = i;
    lb.hidden = false;
    document.body.classList.add('lb-open');
    lbRender();
    $('lbClose').focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.classList.remove('lb-open');
    if (lbIndex !== pageFlip.getCurrentPageIndex()) pageFlip.turnToPage(lbIndex);
    updateStatus();
    $('zoomBtn').focus();
  }

  $('zoomBtn').onclick = () => openLightbox(pageFlip.getCurrentPageIndex());
  $('lbClose').onclick = closeLightbox;
  $('lbPrev').onclick = () => lbGo(-1);
  $('lbNext').onclick = () => lbGo(1);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  // contents links inside the lightbox jump to that page there
  frame.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    lbGo(Number(a.dataset.page) - lbIndex);
  });

  // swipe inside the lightbox
  let sx = null;
  frame.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  frame.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) lbGo(dx < 0 ? 1 : -1);
    sx = null;
  });
})();
