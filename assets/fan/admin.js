/* Login page and admin panel. This page only displays and requests: every action is re-checked by the database,
   which refuses anyone who has not passed the password, the email code, the question and the password change. */
(() => {
  const root = document.getElementById('adminRoot');
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');
  const MIN_PASSWORD = 12;
  function toast(m) {
    const el = $('toast');
    el.textContent = m; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function box(title, inner) {
    root.innerHTML = `<div class="fan-dialog" style="margin:40px auto"><h2>${esc(title)}</h2>${inner}<a class="fan-back" href="index.html">← Back to the website</a></div>`;
  }
  function checkNew(pw, again, min = MIN_PASSWORD) {
    if (pw.length < min) return `Use at least ${min} characters.`;
    const problem = FanAuth.checkPassword(pw);
    if (problem) return problem;
    return pw === again ? '' : 'The two passwords do not match.';
  }
  const newPasswordFields = `
    <div class="field"><label for="aNew">New password</label><input id="aNew" class="text" type="password" autocomplete="new-password" required></div>
    <div class="field"><label for="aNew2">Type it again</label><input id="aNew2" class="text" type="password" autocomplete="new-password" required></div>`;

  /* ---------- Step 1: login, or a new account ---------- */
  function loginView(msg = '') {
    box('Login', `
      <form id="adminLogin" class="fields">
        <div class="field"><label for="aId">Email or ID</label><input id="aId" class="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
        <div class="field"><label for="aPw">Password</label><input id="aPw" class="text" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-wide">Log in</button>
        <button class="fan-link" id="aForgot" type="button">Forgot password?</button>
        <p class="fan-msg err" id="aMsg" role="alert">${esc(msg)}</p>
      </form>`);
    $('aForgot').onclick = () => forgotView();
    $('adminLogin').onsubmit = async (e) => {
      e.preventDefault();
      const out = $('aMsg');
      const id = $('aId').value;
      const email = FanAuth.adminEmail(id);
      out.textContent = 'Checking…';
      if (!email) { // everyone else logs in with their email and goes to Fan Pro
        if (FanAuth.checkEmail(id)) { out.textContent = 'Wrong email, ID or password.'; return; }
        try { await FanAuth.logIn(id, $('aPw').value); location.href = 'fan-pro.html'; } catch (err) {
          out.textContent = /wrong/i.test(err.message) ? 'Wrong email, ID or password.' : err.message;
        }
        return;
      }
      try {
        await FanAuth.logIn(email, $('aPw').value);
        const st = await FanAuth.rpc('fan_admin_status');
        if (st && st.email_proven) { await route(); return; } // the email code is switched off in the database
        await FanAuth.logOut(); // the password only opens the next step
        await FanAuth.sendCode(email);
        codeView(email);
      } catch (err) {
        if (/confirm your email/i.test(err.message)) { out.textContent = 'This account is not ready yet. It must be confirmed in the database.'; return; }
        out.textContent = /wrong/i.test(err.message) ? 'Wrong email, ID or password.' : err.message;
      }
    };
  }

  /* ---------- Step 2: the code sent to the admin email ---------- */
  function codeView(email) {
    box('Enter the email code', `
      <p class="lock-note">A login code was sent to your email. It proves it is really you.</p>
      <form id="adminCode" class="fields">
        <div class="field"><label for="aCode">Code</label><input id="aCode" class="text" inputmode="numeric" autocomplete="one-time-code" required></div>
        <button class="btn btn-primary btn-wide">Log in</button>
        <button class="fan-link" id="aResend" type="button">Send a new code</button>
        <p class="fan-msg err" id="aMsg" role="alert"></p>
      </form>`);
    $('aResend').onclick = async () => {
      try { await FanAuth.sendCode(email); $('aMsg').textContent = 'A new code was sent.'; } catch (err) { $('aMsg').textContent = err.message; }
    };
    $('adminCode').onsubmit = async (e) => {
      e.preventDefault();
      try { await FanAuth.verify(email, $('aCode').value, 'email'); await route(); } catch (err) { $('aMsg').textContent = err.message; }
    };
  }

  function forgotView() {
    box('Reset your password', `
      <p class="lock-note">A reset code goes to the email on the account.</p>
      <form id="aForgotForm" class="fields"><div class="field"><label for="aId">Email or ID</label><input id="aId" class="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <button class="btn btn-primary btn-wide">Send the reset code</button>
      <button class="fan-link" id="aBack" type="button">Back to login</button><p class="fan-msg err" id="aMsg" role="alert"></p></form>`);
    $('aBack').onclick = () => loginView();
    $('aForgotForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const id = $('aId').value;
      const admin = FanAuth.adminEmail(id);
      if (!admin && FanAuth.checkEmail(id)) { $('aMsg').textContent = FanAuth.checkEmail(id); return; }
      const email = admin || id;
      const min = admin ? MIN_PASSWORD : 10;
      try { await FanAuth.recover(email); } catch (err) { $('aMsg').textContent = err.message; return; }
      box('Choose a new password', `
        <form id="aReset" class="fields">
          <div class="field"><label for="aCode">Code from the email</label><input id="aCode" class="text" inputmode="numeric" autocomplete="one-time-code" required></div>
          ${newPasswordFields}
          <button class="btn btn-primary btn-wide">Save and log in</button>
          <p class="fan-msg err" id="aMsg" role="alert"></p>
        </form>`);
      $('aReset').onsubmit = async (e) => {
        e.preventDefault();
        const problem = checkNew($('aNew').value, $('aNew2').value, min);
        if (problem) { $('aMsg').textContent = problem; return; }
        try { await FanAuth.verify(email, $('aCode').value, 'recovery'); await FanAuth.setPassword($('aNew').value); await route(); } catch (err) { $('aMsg').textContent = err.message; }
      };
    };
  }

  /* ---------- Step 3: the question. A wrong answer logs out at once. ---------- */
  function questionPopup(question) {
    root.innerHTML = '';
    const pop = document.createElement('div');
    pop.className = 'fan-modal';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-labelledby', 'qTitle');
    pop.innerHTML = `<form class="fan-dialog fields" id="qForm"><h2 id="qTitle">${esc(question)}</h2>
      <div class="field"><label for="qAnswer">Your answer</label><input id="qAnswer" class="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="200" required></div>
      <div class="row"><button class="btn btn-primary">Continue</button><button class="btn" id="qOut" type="button">Log out</button></div></form>`;
    root.append(pop);
    const leave = async (msg) => { await FanAuth.logOut(); loginView(msg); };
    $('qOut').onclick = () => leave('');
    $('qAnswer').focus();
    $('qForm').onsubmit = async (e) => {
      e.preventDefault();
      let r;
      try { r = await FanAuth.rpc('fan_admin_answer', { p_answer: $('qAnswer').value }); } catch (err) {
        await leave(err.status ? 'You have been logged out.' : err.message);
        return;
      }
      if (r && r.ok) { await route(); return; }
      await leave(r && r.locked ? 'Too many wrong answers. You have been logged out. Try again in 1 hour.' : 'Wrong answer. You have been logged out.');
    };
  }

  /* ---------- Step 4: the start password must be replaced ---------- */
  function forcedPasswordView() {
    box('Choose your password', `
      <p class="lock-note">The start password is only for the first login. Choose your own before the panel opens: at least ${MIN_PASSWORD} characters, with letters and numbers.</p>
      <form id="aForce" class="fields">
        ${newPasswordFields}
        <button class="btn btn-primary btn-wide">Save and open the panel</button>
        <p class="fan-msg err" id="aMsg" role="alert"></p>
      </form>`);
    $('aForce').onsubmit = async (e) => {
      e.preventDefault();
      const problem = checkNew($('aNew').value, $('aNew2').value);
      if (problem) { $('aMsg').textContent = problem; return; }
      try { await FanAuth.setPassword($('aNew').value); await route(); } catch (err) { $('aMsg').textContent = err.message; }
    };
  }

  /* Sends the visitor to the step the database says comes next. */
  async function route() {
    let s;
    try { s = await FanAuth.rpc('fan_admin_status'); } catch (err) {
      if ([400, 401, 403].includes(err.status)) { await FanAuth.logOut(); loginView('Please log in again.'); return; }
      root.innerHTML = `<p class="notice">${esc(err.message)}</p>`;
      return;
    }
    if (!s || !s.admin_email) { location.href = 'fan-pro.html'; return; } // not the admin: their page is Fan Pro
    if (!s.email_proven) { await FanAuth.logOut(); loginView('Please log in again.'); return; }
    if (!s.question_passed) { questionPopup(s.question); return; }
    if (!s.password_changed) { forcedPasswordView(); return; }
    await panel();
  }

  /* ---------- Panel ---------- */
  let users = [];
  const isSuper = (u) => u.email.toLowerCase() === String(window.FAN_CONFIG.adminEmail || '').toLowerCase();
  const hasAccess = (u) => isSuper(u) || (u.access_until && new Date(u.access_until).getTime() > Date.now());
  function userRows(filter = '') {
    const f = filter.trim().toLowerCase();
    const list = users.filter((u) => !f || u.email.includes(f) || String(u.note || '').toLowerCase().includes(f));
    return list.map((u) => `<tr data-email="${esc(u.email)}"><td>${esc(u.email)}${u.note ? `<span class="why">${esc(u.note)}</span>` : ''}</td>
      <td>${isSuper(u) ? '<span class="pill ok">Superadmin</span>' : hasAccess(u) ? `<span class="pill ok">${u.plan === 'pro' ? 'Pro' : 'Basic'}</span>` : '<span class="pill warn">No access</span>'}</td><td>${isSuper(u) ? 'Unlimited' : when(u.access_until)}</td><td>${when(u.created_at)}</td><td>${when(u.last_login)}</td>
      <td class="n"><button class="fan-link" data-warn="1">${Number(u.warnings) || 0}</button></td>
      <td>${isSuper(u) ? 'Unlimited' : '<div class="admin-actions"><button class="btn" data-days="1" data-plan="trial">Basic 1 day</button><button class="btn" data-days="7" data-plan="trial">Basic 7 days</button><button class="btn btn-primary" data-days="30" data-plan="pro">Pro 1 month</button><button class="btn" data-custom="1">Other…</button><button class="btn btn-danger" data-days="0" data-plan="none">End</button></div>'}</td></tr>`).join('')
      || '<tr><td colspan="7">No accounts found.</td></tr>';
  }

  async function panel() {
    let settings, log;
    try {
      [users, settings, log] = await Promise.all([FanAuth.rpc('fan_admin_list'), FanAuth.rpc('fan_admin_settings'), FanAuth.rpc('fan_admin_log_list')]);
    } catch (err) {
      if ([400, 401, 403].includes(err.status)) { await FanAuth.logOut(); loginView('Please log in again.'); return; }
      root.innerHTML = `<p class="notice">${esc(err.message)}</p>`;
      return;
    }
    const active = users.filter(hasAccess);
    root.innerHTML = `<div class="row space-between"><div><h2>Admin panel</h2><p class="lock-note">Logged in as ${esc(FanAuth.email())}. The email code and question are asked again after 12 hours.</p></div>
        <div class="row"><a class="btn" href="fan-pro.html">Open Fan Pro</a><a class="btn" href="index.html">Open website</a><button class="btn" id="aOut" type="button">Log out</button></div></div>
      <div class="admin-stats">
        <div class="card"><b>${users.length}</b><span>Accounts</span></div>
        <div class="card"><b>${active.length}</b><span>With access now</span></div>
        <div class="card"><b>${active.filter((u) => u.plan === 'pro').length}</b><span>On Pro</span></div>
        <div class="card"><b>${users.reduce((n, u) => n + (Number(u.warnings) || 0), 0)}</b><span>Warnings recorded</span></div>
      </div>
      <div class="card"><div class="row space-between"><h3>Fan software users</h3><div class="row"><input id="aSearch" class="text" type="search" placeholder="Search email or note" aria-label="Search users"><button class="btn" id="aAllWarn" type="button">All warnings</button></div></div>
        <div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Status</th><th>Access until</th><th>Signed up</th><th>Last login</th><th class="n">Warnings</th><th>Give access</th></tr></thead>
        <tbody id="aUsers">${userRows()}</tbody>
      </table></div></div>
      <div class="card" id="warnBox" hidden></div>
      <div class="admin-grid">
        <form class="card fields" id="aNewUser" autocomplete="off"><h3>Create a user</h3>
          <div class="field"><label for="nuEmail">Email (their login ID)</label><input id="nuEmail" class="text" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="254" required></div>
          <div class="field"><label for="nuPw">Password</label><input id="nuPw" class="text" type="password" autocomplete="new-password" maxlength="72" required></div>
          <div class="field"><label for="nuPlan">Level</label><select id="nuPlan" class="text"><option value="trial">Basic: up to 1,000 kW</option><option value="pro" selected>Pro: up to 10,000 kW</option></select></div>
          <div class="field"><label for="nuDays">Access days</label><input id="nuDays" class="text" type="number" min="1" max="3650" step="1" value="30" required></div>
          <div class="field"><label for="nuNote">Note (optional)</label><input id="nuNote" class="text" maxlength="200" autocomplete="off"></div>
          <button class="btn btn-primary">Create user</button><p class="lock-note">At least 10 characters in the password, with letters and numbers. Only people you create here can log in.</p><p class="fan-msg err" id="nuMsg" role="alert"></p></form>
        <form class="card fields" id="aPwForm"><h3>Change my password</h3>${newPasswordFields}
          <button class="btn btn-primary">Change password</button><p class="fan-msg err" id="aPwMsg" role="alert"></p></form>
        <form class="card fields" id="aQForm"><h3>Change my login question</h3>
          <div class="field"><label for="aQ">Question</label><input id="aQ" class="text" maxlength="200" autocomplete="off" required></div>
          <div class="field"><label for="aA">Answer</label><input id="aA" class="text" maxlength="200" autocomplete="off" required></div>
          <button class="btn btn-primary">Save question</button><p class="lock-note">Capital letters and extra spaces do not matter when you answer.</p></form>
        <div class="card fields"><h3>The rest of the website</h3>
          <p class="lock-note">Pages, blog and market data change through your GitHub login, and the database through your Supabase login. Keep 2-step login on for both and for your Gmail.</p>
          <a class="fan-link" rel="noopener" target="_blank" href="https://github.com/pathakvedant/vedant-contact">Website files on GitHub</a>
          <a class="fan-link" rel="noopener" target="_blank" href="https://github.com/pathakvedant/vedant-contact/actions">Market data and publishing runs</a>
          <a class="fan-link" rel="noopener" target="_blank" href="https://supabase.com/dashboard">Supabase database</a>
          <p class="lock-note">Engine version: ${esc(settings.engine_version)}</p></div>
      </div>
      <div class="card"><h3>Admin activity</h3><div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>For</th></tr></thead>
        <tbody>${log.map((r) => `<tr><td>${when(r.created_at)}</td><td>${esc(r.action)}</td><td>${esc(r.target)}</td></tr>`).join('') || '<tr><td colspan="3">Nothing yet.</td></tr>'}</tbody></table></div></div>`;
    $('aOut').onclick = async () => { await FanAuth.logOut(); loginView(); };
    $('aSearch').oninput = (e) => { $('aUsers').innerHTML = userRows(e.target.value); };
    $('aAllWarn').onclick = () => showWarnings('');
    $('aUsers').onclick = onUserAction;
    $('aNewUser').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('nuEmail').value.trim().toLowerCase(), pw = $('nuPw').value, days = Number($('nuDays').value), msg = $('nuMsg');
      const problem = FanAuth.checkEmail(email) || FanAuth.checkPassword(pw);
      if (problem) { msg.textContent = problem; return; }
      if (!Number.isInteger(days) || days < 1 || days > 3650) { msg.textContent = 'Enter between 1 and 3650 days.'; return; }
      if (users.some((u) => u.email === email)) { msg.textContent = 'This email already has an account.'; return; }
      msg.textContent = 'Creating…';
      try { await FanAuth.rpc('fan_admin_create_user', { p_email: email, p_password: pw, p_plan: $('nuPlan').value, p_days: days, p_note: $('nuNote').value }); toast(`${email}: account created for ${days} days.`); panel(); } catch (err) { msg.textContent = err.message; }
    };
    $('aPwForm').onsubmit = async (e) => {
      e.preventDefault();
      const problem = checkNew($('aNew').value, $('aNew2').value);
      if (problem) { $('aPwMsg').textContent = problem; return; }
      try { await FanAuth.setPassword($('aNew').value); toast('Password changed.'); panel(); } catch (err) { $('aPwMsg').textContent = err.message; }
    };
    $('aQForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await FanAuth.rpc('fan_admin_set_question', { p_question: $('aQ').value, p_answer: $('aA').value }); toast('Login question changed.'); panel(); } catch (err) { toast(err.message); }
    };
  }

  async function onUserAction(e) {
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
      panel();
    } catch (err) { toast(err.message); }
  }

  async function showWarnings(email) {
    const el = $('warnBox');
    el.hidden = false;
    el.textContent = 'Loading…';
    try {
      const rows = await FanAuth.rpc('fan_admin_warnings', { p_email: email });
      el.innerHTML = `<h3>${email ? `Warnings recorded for ${esc(email)}` : 'All warnings recorded'}</h3><div class="table-wrap"><table><thead><tr><th>When</th><th>Account</th><th>Type</th><th>Warning</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${when(r.created_at)}</td><td>${esc(r.email)}</td><td>${esc(r.kind)}</td><td>${esc(r.message)}</td></tr>`).join('') || '<tr><td colspan="4">None recorded.</td></tr>'}</tbody></table></div>`;
      el.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { el.textContent = err.message; }
  }

  if (!FanAuth.ready()) root.innerHTML = '<p class="notice"><b>Not set up yet.</b> Fill in assets/fan/config.js after creating the Supabase project.</p>';
  else if (FanAuth.hasSession()) route();
  else loginView();
})();
