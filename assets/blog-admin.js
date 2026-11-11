/* Blog editor for the superadmin. Write on the left, see the finished post on the right, click a picture to place it.
   Publishing sends the post to the private server, which checks the superadmin login and commits it to GitHub.
   Picture line format, shared with tools/build_site.py and assets/app.js:
   ![alt text|caption](images/file.jpg){full|center|left|right|cover} */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IMG_LINE = /^!\[([^\]|]*)(?:\|([^\]]*))?\]\((images\/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|png|webp))\)(?:\{(full|center|left|right|cover)\})?$/;
  const POS_LABEL = { full: 'Full width', center: 'Centre', left: 'Left', right: 'Right', cover: 'Cover' };
  const POSTS = window.POSTS || [];
  const DRAFT = 'traass_blog_draft';
  const DEFAULT_ALT = 'Describe the picture';
  const pics = {}; // new pictures in this post: name -> data URL
  let selLine = -1, isAdmin = false, slugTouched = false, view = 'page';

  const f = { title: $('fTitle'), slug: $('fSlug'), date: $('fDate'), cat: $('fCat'), tags: $('fTags'), excerpt: $('fExcerpt'), body: $('fBody') };
  const status = (t, kind = '') => { $('status').textContent = t; $('status').className = 'ba-status ' + kind; };

  /* ---------- Text rules (the server applies the same ones) ---------- */
  const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 80).replace(/-+$/, '');
  const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/\\/g, '/').replace(/"/g, '”').trim();
  const cleanBody = (s) => String(s).replace(/\r/g, '').replace(/\\/g, '/').replace(/`/g, "'").replace(/\$\{/g, '$ {').trim();
  const picText = (s) => String(s).replace(/[\]\[|()\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const post = () => ({
    slug: f.slug.value.trim(), date: f.date.value, cat: oneLine(f.cat.value), title: oneLine(f.title.value), excerpt: oneLine(f.excerpt.value),
    tags: f.tags.value.split(',').map(oneLine).filter(Boolean).slice(0, 10), body: cleanBody(f.body.value),
  });

  /* ---------- Picture lines ---------- */
  const parsePic = (line) => { const m = IMG_LINE.exec(line.trim()); return m ? { alt: m[1].trim(), cap: (m[2] || '').trim(), src: m[3], pos: m[4] || 'center' } : null; };
  const picLine = (p) => `![${picText(p.alt)}${p.cap ? '|' + picText(p.cap) : ''}](${p.src}){${p.pos}}`;
  const lines = () => f.body.value.split('\n');
  const setLines = (ls) => { f.body.value = ls.join('\n'); changed(); };
  const picSrc = (src) => { const name = src.slice(7); return pics[name] || 'blog/' + src; };

  /* ---------- Preview: the same rules the website uses ---------- */
  function md(text) {
    const out = []; let list = false;
    const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text.split('\n').forEach((raw, i) => {
      const l = raw.trim();
      if (/^- /.test(l)) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inl(l.slice(2)) + '</li>'); return; }
      if (list) { out.push('</ul>'); list = false; }
      const p = parsePic(l);
      if (p) {
        out.push(`<figure class="pimg pimg-${p.pos}${i === selLine ? ' sel' : ''}" data-line="${i}"><span class="tag">${POS_LABEL[p.pos]}</span><img src="${esc(picSrc(p.src))}" alt="${esc(p.alt)}">${p.cap ? `<figcaption>${esc(p.cap)}</figcaption>` : ''}</figure>`);
        return;
      }
      if (!l) return;
      if (/^## /.test(l)) out.push('<h2>' + inl(l.slice(3)) + '</h2>');
      else if (/^> /.test(l)) out.push('<blockquote>' + inl(l.slice(2)) + '</blockquote>');
      else out.push('<p>' + inl(l) + '</p>');
    });
    if (list) out.push('</ul>');
    return out.join('');
  }
  const coverOf = (body) => { const ps = body.split('\n').map(parsePic).filter(Boolean); return ps.find((p) => p.pos === 'cover') || ps[0] || null; };

  function render() {
    const p = post();
    const mins = Math.max(1, Math.round((p.body.split(/\s+/).filter(Boolean).length) / 200));
    $('pvPage').innerHTML = `<article><div class="meta"><span class="c">${esc(p.cat || 'Category')}</span><time>${esc(p.date)}</time><span>${mins} min read</span></div>
      <h1>${esc(p.title || 'Your title')}</h1><p class="answer"><strong>Short answer:</strong> ${esc(p.excerpt || 'Your short answer appears here.')}</p>
      <div class="content">${md(f.body.value)}</div></article>`;
    const c = coverOf(f.body.value);
    $('pvCard').innerHTML = `<article class="card post"><div class="cover${c ? ' pic' : ''}">${c ? `<img src="${esc(picSrc(c.src))}" alt="${esc(c.alt)}">` : '📝'}</div>
      <div class="body"><div class="meta"><span class="c">${esc(p.cat || 'Category')}</span><span>${esc(p.date)}</span><span>${mins} min read</span></div><h3>${esc(p.title || 'Your title')}</h3><p>${esc(p.excerpt)}</p></div></article>`;
    $('pvPage').querySelectorAll('figure[data-line]').forEach((fig) => { fig.onclick = () => openPic(Number(fig.dataset.line)); });
  }

  /* ---------- Checks: what Google, AI tools and readers need ---------- */
  function checks() {
    const p = post(), out = [];
    const add = (lvl, t) => out.push({ lvl, t });
    if (!p.title) add('bad', 'Add a title.'); else if (p.title.length < 25 || p.title.length > 70) add('warn', `Title is ${p.title.length} characters. 25 to 70 shows best in Google.`); else add('good', 'Title length is good.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) add('bad', 'Web address: use lowercase letters, numbers and hyphens.');
    else if (POSTS.some((x) => x.slug === p.slug)) add('bad', 'A post with this web address already exists. Change it.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) add('bad', 'Pick a date.');
    if (!p.cat) add('bad', 'Pick or type a category.');
    if (!p.excerpt) add('bad', 'Write the short answer.'); else if (p.excerpt.length < 90 || p.excerpt.length > 200) add('warn', `Short answer is ${p.excerpt.length} characters. 90 to 200 is ideal for Google and AI answers.`);
    const words = p.body.split(/\s+/).filter(Boolean).length;
    if (words < 150) add(words ? 'warn' : 'bad', `Article has ${words} words. 300 or more ranks better.`);
    if (!/^## /m.test(p.body)) add('warn', 'Add at least one ## heading.');
    const ps = p.body.split('\n').map(parsePic).filter(Boolean);
    ps.forEach((x) => { if (!x.alt || x.alt === DEFAULT_ALT) add('bad', `Write alt text for ${x.src.slice(7)}: describe what the picture shows.`); });
    if (ps.filter((x) => x.pos === 'cover').length > 1) add('warn', 'More than one cover picture: the first is used.');
    const kw = ['vedant pathak', 'apcd', 'air pollution control', 'centrifugal fan', 'fan software', 'b2b marketing', 'digital marketing', 'share market', 'stock market', 'python'];
    const hay = (p.title + ' ' + p.excerpt + ' ' + p.tags.join(' ')).toLowerCase();
    if (!kw.some((k) => hay.includes(k))) add('warn', 'Tip: put one of your focus phrases (APCD consultant, centrifugal fan software, B2B marketing, share market using Python…) in the title, short answer or tags.');
    $('checks').innerHTML = '<ul>' + out.map((x) => `<li class="${x.lvl}">${x.lvl === 'good' ? '✓' : x.lvl === 'warn' ? '!' : '✗'} ${esc(x.t)}</li>`).join('') + '</ul>';
    const blocking = out.some((x) => x.lvl === 'bad');
    $('publish').disabled = !isAdmin || blocking;
    $('publish').title = !isAdmin ? 'Log in as the superadmin first' : blocking ? 'Fix the items marked ✗' : '';
    return !blocking;
  }

  /* ---------- Draft ---------- */
  function save() {
    const d = { title: f.title.value, slug: f.slug.value, date: f.date.value, cat: f.cat.value, tags: f.tags.value, excerpt: f.excerpt.value, body: f.body.value, slugTouched };
    try { localStorage.setItem(DRAFT, JSON.stringify({ ...d, pics })); } catch {
      try { localStorage.setItem(DRAFT, JSON.stringify(d)); status('Draft saved without pictures (too large to keep in the browser). Keep this tab open until you publish.', 'warn'); } catch { /* storage off */ }
    }
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { d = null; }
    f.date.value = new Date().toISOString().slice(0, 10);
    if (!d) return;
    ['title', 'slug', 'date', 'cat', 'tags', 'excerpt', 'body'].forEach((k) => { if (d[k]) f[k].value = d[k]; });
    slugTouched = Boolean(d.slugTouched);
    Object.assign(pics, d.pics || {});
  }
  function changed() { render(); checks(); save(); }

  /* ---------- Writing tools ---------- */
  function insertAtLine(text) {
    const v = f.body.value, at = f.body.selectionStart ?? v.length;
    const end = v.indexOf('\n', at) === -1 ? v.length : v.indexOf('\n', at);
    const before = v.slice(0, end), after = v.slice(end);
    f.body.value = before + (before && !before.endsWith('\n') ? '\n' : '') + text + (after.startsWith('\n') ? '' : '\n') + after;
    const pos = (before + '\n' + text).length;
    f.body.focus(); f.body.setSelectionRange(pos, pos);
    changed();
  }
  document.querySelectorAll('[data-ins]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.ins, s = f.body.selectionStart, e = f.body.selectionEnd, sel = f.body.value.slice(s, e);
      if (k === 'b') { f.body.setRangeText(`**${sel || 'bold text'}**`, s, e, 'end'); f.body.focus(); changed(); return; }
      insertAtLine({ h2: '## ', li: '- ', q: '> ' }[k] + (sel || ''));
    };
  });

  async function resize(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const scale = Math.min(1, 1600 / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, data = c.toDataURL('image/jpeg', q);
      while (data.length > 1.3e6 && q > 0.5) { q -= 0.1; data = c.toDataURL('image/jpeg', q); } // keep each picture under about 1 MB
      return data;
    } finally { URL.revokeObjectURL(url); }
  }
  $('addPic').onclick = () => $('picFile').click();
  $('picFile').onchange = async () => {
    const files = [...$('picFile').files].slice(0, 8);
    $('picFile').value = '';
    for (const file of files) {
      if (Object.keys(pics).length >= 12) { status('A post can have up to 12 pictures.', 'warn'); break; }
      status(`Preparing ${file.name}…`);
      try {
        const base = (f.slug.value.trim() || 'post').slice(0, 40).replace(/-+$/, '');
        let n = 1; while (pics[`${base}-${n}.jpg`] || f.body.value.includes(`images/${base}-${n}.jpg`)) n += 1;
        const name = `${base}-${n}.jpg`;
        pics[name] = await resize(file);
        insertAtLine(picLine({ alt: DEFAULT_ALT, cap: '', src: `images/${name}`, pos: Object.keys(pics).length === 1 ? 'cover' : 'center' }));
        status(`${name} added. Click it in the preview to place it and write its alt text.`, 'ok');
      } catch { status(`Could not read ${file.name}. Use a JPG, PNG or WebP picture.`, 'bad'); }
    }
  };

  /* ---------- Picture placement bar ---------- */
  function openPic(i) {
    const p = parsePic(lines()[i] || ''); if (!p) return;
    selLine = i;
    $('picName').textContent = p.src.slice(7);
    $('picAlt').value = p.alt === DEFAULT_ALT ? '' : p.alt;
    $('picCap').value = p.cap;
    document.querySelectorAll('[data-pos]').forEach((b) => b.classList.toggle('on', b.dataset.pos === p.pos));
    $('picBar').hidden = false;
    render();
    $('picAlt').focus();
  }
  function editPic(fn) { const ls = lines(); const p = parsePic(ls[selLine] || ''); if (!p) return; fn(p); ls[selLine] = picLine(p); setLines(ls); openPic(selLine); }
  document.querySelectorAll('[data-pos]').forEach((b) => { b.onclick = () => editPic((p) => { p.pos = b.dataset.pos; }); });
  $('picAlt').oninput = () => editPic((p) => { p.alt = $('picAlt').value || DEFAULT_ALT; });
  $('picCap').oninput = () => editPic((p) => { p.cap = $('picCap').value; });
  document.querySelectorAll('[data-move]').forEach((b) => {
    b.onclick = () => {
      const ls = lines(), dir = Number(b.dataset.move);
      let j = selLine + dir; while (j >= 0 && j < ls.length && !ls[j].trim()) j += dir; // skip blank lines: move past one block
      if (j < 0 || j >= ls.length) return;
      [ls[selLine], ls[j]] = [ls[j], ls[selLine]];
      selLine = j; setLines(ls); openPic(j);
    };
  });
  $('picDel').onclick = () => {
    const ls = lines(), p = parsePic(ls[selLine] || ''); if (!p) return;
    ls.splice(selLine, 1); setLines(ls);
    if (!f.body.value.includes(p.src)) delete pics[p.src.slice(7)];
    closePic(); changed();
  };
  const closePic = () => { selLine = -1; $('picBar').hidden = true; render(); };
  $('picDone').onclick = closePic;

  /* ---------- posts.js entry (same format as the server writes) ---------- */
  const js = (s) => JSON.stringify(s);
  const entry = (p) => `{\n slug: ${js(p.slug)},\n date: ${js(p.date)},\n cat: ${js(p.cat)},\n title: ${js(p.title)},\n excerpt: ${js(p.excerpt)},\n tags: [${p.tags.map(js).join(',')}],\n body: \`\n${p.body}\n\`\n},`;
  const usedPics = (body) => Object.keys(pics).filter((n) => body.includes('images/' + n));

  $('download').onclick = () => {
    if (!checks()) { status('Fix the items marked ✗ first.', 'bad'); return; }
    const p = post();
    const note = `Paste this block at the TOP of the list in blog/posts.js (just after "window.POSTS = ["),\nput the pictures in blog/images/, then run: python tools/build_site.py and upload.\n\n`;
    const dl = (name, href) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    const txt = URL.createObjectURL(new Blob([note + entry(p) + '\n'], { type: 'text/plain' }));
    dl(`post-${p.slug}.txt`, txt); setTimeout(() => URL.revokeObjectURL(txt), 4000);
    usedPics(p.body).forEach((n, i) => setTimeout(() => dl(n, pics[n]), 300 * (i + 1)));
    status('Downloaded the post entry and its pictures.', 'ok');
  };

  $('publish').onclick = async () => {
    if (!checks() || !isAdmin) return;
    const p = post(), cfg = window.FAN_CONFIG || {};
    const api = String(cfg.apiUrl || '').replace(/\/+$/, '');
    if (!api) { status('The server address is not set in assets/fan/config.js.', 'bad'); return; }
    const images = usedPics(p.body).map((n) => ({ name: n, data: pics[n].split(',')[1] }));
    $('publish').disabled = true; status('Publishing… the server may take up to a minute to wake up.');
    try {
      const r = await fetch(api + '/api/blog/publish', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Authorization: 'Bearer ' + (await FanAuth.accessToken()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: p, images }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `The server said ${r.status}.`);
      try { localStorage.removeItem(DRAFT); } catch { /* fine */ }
      POSTS.unshift({ slug: p.slug });
      $('status').innerHTML = `✓ Published. The post page is built automatically and is live in about 2 minutes: <a href="https://traass.in/blog/${esc(p.slug)}.html" target="_blank" rel="noopener">traass.in/blog/${esc(p.slug)}.html</a>`;
      $('status').className = 'ba-status ok';
    } catch (err) { status(err.message || 'Could not publish.', 'bad'); checks(); }
  };

  $('clear').onclick = () => {
    if (f.body.value.trim() && !confirm('Start a new post? The current draft will be cleared.')) return;
    Object.values(f).forEach((x) => { x.value = ''; });
    Object.keys(pics).forEach((k) => delete pics[k]);
    slugTouched = false; f.date.value = new Date().toISOString().slice(0, 10);
    try { localStorage.removeItem(DRAFT); } catch { /* fine */ }
    closePic(); changed(); status('');
  };

  /* ---------- Fields and tabs ---------- */
  f.title.oninput = () => { if (!slugTouched) f.slug.value = slugify(f.title.value); changed(); };
  f.slug.oninput = () => { slugTouched = true; const pos = f.slug.selectionStart; f.slug.value = f.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'); f.slug.setSelectionRange(pos, pos); changed(); };
  [f.date, f.cat, f.tags, f.body].forEach((x) => { x.oninput = changed; });
  f.excerpt.oninput = () => { $('exCount').textContent = `${f.excerpt.value.length} / 200`; changed(); };
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      view = b.dataset.view;
      document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
      $('pvPage').hidden = view !== 'page'; $('pvCard').hidden = view !== 'card';
    };
  });
  $('cats').innerHTML = [...new Set(POSTS.map((p) => p.cat))].map((c) => `<option value="${esc(c)}">`).join('');

  /* ---------- Who is logged in ---------- */
  async function whoAmI() {
    const who = $('who'), A = typeof FanAuth !== 'undefined' ? FanAuth : null; // auth.js declares a top-level const, not a window property
    if (!A || !A.ready()) { who.textContent = 'Login is not set up on this page.'; return; }
    if (!A.hasSession()) { who.innerHTML = 'Not logged in. <a href="fan-admin.html">Log in as admin</a>, then come back. You can write and preview now.'; return; }
    try {
      const info = await A.rpc('fan_my_access');
      isAdmin = Boolean(info && info.active && info.plan === 'superadmin');
      who.textContent = isAdmin ? `Superadmin: ${A.email()}` : 'This login is not the superadmin, so it cannot publish.';
      who.classList.toggle('ok', isAdmin);
    } catch { who.innerHTML = 'Login expired. <a href="fan-admin.html">Log in as admin again</a>.'; }
    checks();
  }

  load();
  f.excerpt.oninput();
  changed();
  whoAmI();
})();
