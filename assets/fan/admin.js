/* Admin panel. This page only displays and requests: every action is re-checked by the database,
   which refuses anyone who is not the admin account. */
(() => {
  const root = document.getElementById('adminRoot');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');
  function toast(m) {
    const el = document.getElementById('toast');
    el.textContent = m; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function loginView(msg = '') {
    root.innerHTML = `<div class="fan-dialog" style="margin:40px auto">
      <h2>Fan software admin</h2>
      <form id="adminLogin" class="fields">
        <div class="field"><label for="aEmail">Admin email</label><input id="aEmail" class="text" type="email" autocomplete="username" required></div>
        <div class="field"><label for="aPw">Password</label><input id="aPw" class="text" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-wide">Log in</button>
        <p class="fan-msg err" id="aMsg" role="alert">${esc(msg)}</p>
      </form>
      <a class="fan-back" href="fan-software.html">← Back to the fan software</a>
    </div>`;
    document.getElementById('adminLogin').onsubmit = async (e) => {
      e.preventDefault();
      const out = document.getElementById('aMsg');
      out.textContent = 'Checking…';
      try { await FanAuth.logIn(document.getElementById('aEmail').value, document.getElementById('aPw').value); await listView(); } catch (err) { out.textContent = err.message; }
    };
  }

  async function listView() {
    let users;
    try { users = await FanAuth.rpc('fan_admin_list'); } catch (err) {
      if (err.status === 403 || err.status === 400 || err.status === 401) { await FanAuth.logOut(); loginView('This account is not the admin.'); return; }
      root.innerHTML = `<p class="notice">${esc(err.message)}</p>`;
      return;
    }
    const now = Date.now();
    const state = (u) => (u.access_until && new Date(u.access_until).getTime() > now ? `<span class="pill ok">${esc(u.plan)}</span>` : '<span class="pill warn">No access</span>');
    root.innerHTML = `<div class="row space-between"><div><h2>Fan software users</h2><p class="lock-note">${users.length} accounts. Give each person the time you agreed with them.</p></div>
        <div class="row"><a class="btn" href="fan-pro.html">Open Fan Pro</a><button class="btn" id="aOut" type="button">Log out</button></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Status</th><th>Access until</th><th>Signed up</th><th class="n">Warnings</th><th>Give access</th></tr></thead>
        <tbody>${users.map((u) => `<tr data-email="${esc(u.email)}"><td>${esc(u.email)}${u.note ? `<span class="why">${esc(u.note)}</span>` : ''}</td><td>${state(u)}</td><td>${when(u.access_until)}</td><td>${when(u.created_at)}</td>
          <td class="n"><button class="fan-link" data-warn="1">${Number(u.warnings) || 0}</button></td>
          <td><div class="admin-actions"><button class="btn" data-days="1" data-plan="trial">1 day</button><button class="btn" data-days="7" data-plan="trial">7 days</button><button class="btn btn-primary" data-days="30" data-plan="pro">Pro 1 month</button><button class="btn" data-custom="1">Other…</button><button class="btn btn-danger" data-days="0" data-plan="none">End</button></div></td></tr>`).join('') || '<tr><td colspan="6">No accounts yet.</td></tr>'}</tbody>
      </table></div></div>
      <div class="card" id="warnBox" hidden></div>`;
    document.getElementById('aOut').onclick = async () => { await FanAuth.logOut(); loginView(); };
    root.querySelector('tbody').onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const email = b.closest('tr').dataset.email;
      if (b.dataset.warn) { showWarnings(email); return; }
      let days = Number(b.dataset.days);
      let plan = b.dataset.plan;
      if (b.dataset.custom) {
        days = Number(prompt(`How many days of access for ${email}?`, '15'));
        if (!Number.isFinite(days) || days <= 0 || days > 3650) { if (days) toast('Enter between 1 and 3650 days.'); return; }
        plan = 'pro';
      }
      try {
        await FanAuth.rpc('fan_admin_set_access', { p_email: email, p_days: days, p_plan: plan, p_note: '' });
        toast(days ? `${email}: access for ${days} days from now.` : `${email}: access ended.`);
        listView();
      } catch (err) { toast(err.message); }
    };
  }

  async function showWarnings(email) {
    const box = document.getElementById('warnBox');
    box.hidden = false;
    box.innerHTML = 'Loading…';
    try {
      const rows = await FanAuth.rpc('fan_admin_warnings', { p_email: email });
      box.innerHTML = `<h3>Warnings recorded for ${esc(email)}</h3><div class="table-wrap"><table><thead><tr><th>When</th><th>Type</th><th>Warning</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${when(r.created_at)}</td><td>${esc(r.kind)}</td><td>${esc(r.message)}</td></tr>`).join('') || '<tr><td colspan="3">None recorded.</td></tr>'}</tbody></table></div>`;
      box.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { box.textContent = err.message; }
  }

  if (!FanAuth.ready()) root.innerHTML = '<p class="notice"><b>Not set up yet.</b> Fill in assets/fan/config.js after creating the Supabase project.</p>';
  else if (FanAuth.hasSession()) listView();
  else loginView();
})();
