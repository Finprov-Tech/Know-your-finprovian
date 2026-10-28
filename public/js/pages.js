// Shared page renderers — used by the booklet and the HR preview.
(function () {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function polaroid(src, caption, tilt) {
    const card = el('figure', 'polaroid');
    card.style.setProperty('--tilt', tilt + 'deg');
    const img = el('img');
    img.src = src;
    img.alt = caption;
    img.decoding = 'async';
    img.draggable = false;
    card.append(img, el('figcaption', null, caption));
    return card;
  }

  // A finprovian page: either their finished poster, or a page built from details.
  function renderMember(entry) {
    if (entry.type === 'poster') {
      const wrap = el('div', 'member-poster');
      const bg = el('div', 'mpo-bg');
      bg.style.backgroundImage = `url("${entry.image}")`;
      const img = el('img');
      img.src = entry.image;
      img.alt = `Know Your Finprovian — ${entry.name}`;
      img.decoding = 'async';
      img.draggable = false;
      wrap.append(bg, img);
      return wrap;
    }

    const page = el('div', 'member-profile');

    const brand = el('div', 'mp-brand');
    const logo = el('img');
    logo.src = '/img/finprov-logo.png';
    logo.alt = 'Finprov';
    logo.draggable = false;
    brand.append(logo);
    page.append(brand);

    const photos = el('div', 'mp-photos' + (entry.familyPhoto ? '' : ' single'));
    if (entry.photo) photos.append(polaroid(entry.photo, entry.name.split(' ')[0], -6));
    if (entry.familyPhoto) photos.append(polaroid(entry.familyPhoto, 'Family ♥', 5));
    page.append(photos);

    const title = el('h3', 'mp-title');
    title.append(el('span', 'k', 'Know Your'), el('span', 's', 'finprovian'));
    page.append(title);

    const who = el('p', 'mp-who');
    who.append(el('strong', null, entry.name));
    if (entry.role) who.append(el('span', null, entry.role));
    page.append(who);

    page.append(el('div', 'mp-intro', entry.intro || ''));
    return page;
  }

  // Shrink a text block (in container-width units, so it scales with the page) until it fits.
  function fitText(node, startCqw = 3.3) {
    if (!node || !node.clientHeight) return false;
    let size = startCqw;
    node.style.fontSize = size + 'cqw';
    while (node.scrollHeight > node.clientHeight + 1 && size > 1.6) {
      size -= 0.1;
      node.style.fontSize = size.toFixed(2) + 'cqw';
    }
    return true;
  }

  window.KYF = { el, renderMember, fitText };
})();
