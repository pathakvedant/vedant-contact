/* Fan Pro screens: account forms first, then the design tool once the server grants access.
   The calculation engine is not on this website. The database hands it only to people with active access. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const auth = $('#authScreen');
  const app = $('#appScreen');
  const ADMIN = (window.FAN_CONFIG && window.FAN_CONFIG.adminEmail) || '';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  function toast(m) {
    const el = $('#toast');
    el.textContent = m; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200);
  }
  const brand = '<div class="fan-auth-brand"><img src="favicon.svg" alt=""><b style="font:700 24px var(--font-display)">TRAASS Fan Pro</b></div>';

  /* ---------- Accounts ---------- */

  function shell(title, body, foot = '') {
    auth.hidden = false; app.hidden = true;
    auth.innerHTML = `${brand}<div class="fan-dialog"><h2>${title}</h2>${body}</div>
      <a class="fan-back" href="fan-software.html">← Back to the trial version</a>${foot}`;
  }
  const setMsg = (text, kind = 'err') => { const m = $('#msg'); if (m) { m.textContent = text; m.className = `fan-msg ${kind}`; } };
  function busy(form, on) { form.querySelectorAll('button').forEach((b) => { b.disabled = on; }); }

  function entry(mode = location.hash === '#signup' ? 'signup' : 'login', notice = '') {
    const signup = mode === 'signup';
    shell(signup ? 'Create your Fan Pro account' : 'Log in to Fan Pro', `
      <div class="fan-tabs"><button type="button" id="tabLogin" aria-pressed="${!signup}">Log in</button><button type="button" id="tabSignup" aria-pressed="${signup}">Create account</button></div>
      ${signup ? '<p class="lock-note">Your first day of Fan Pro is free. We email you a code to confirm your address.</p>' : ''}
      <form id="entryForm" class="fields" novalidate>
        <div class="field"><label for="email">Email</label><input id="email" class="text" type="email" autocomplete="username" required maxlength="254"></div>
        <div class="field"><label for="pw">Password</label><input id="pw" class="text" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required maxlength="72">${signup ? '<small>At least 10 characters, with letters and numbers.</small>' : ''}</div>
        <button class="btn btn-primary btn-wide">${signup ? 'Create account and send code' : 'Log in'}</button>
        <p class="fan-msg ${notice ? 'ok' : 'err'}" id="msg" role="alert">${esc(notice)}</p>
      </form>
      ${signup ? '' : '<button class="fan-link" id="forgot" type="button">Forgot your password?</button>'}`);
    $('#tabLogin').onclick = () => entry('login');
    $('#tabSignup').onclick = () => entry('signup');
    if (!signup) $('#forgot').onclick = forgot;
    $('#entryForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#email').value, pw = $('#pw').value;
      if (!signup && FanAuth.adminEmail(email)) { location.href = 'fan-admin.html'; return; } // this account has its own login steps
      const problem = FanAuth.checkEmail(email) || (signup ? FanAuth.checkPassword(pw) : (pw ? '' : 'Enter your password.'));
      if (problem) { setMsg(problem); return; }
      busy(e.target, true); setMsg('Please wait…', 'ok');
      try {
        if (signup) { await FanAuth.signUp(email, pw); otp(email); }
        else { await FanAuth.logIn(email, pw); await afterLogin(); }
      } catch (err) {
        if (!signup && /confirm your email/.test(err.message)) { otp(email, 'Enter the code from your confirmation email, or request a new one.'); return; }
        setMsg(err.message); busy(e.target, false);
      }
    };
    $('#email').focus();
  }

  function otp(email, notice = '') {
    shell('Check your email', `
      <p>We sent a confirmation code to <b>${esc(email)}</b>. It may take a minute, so look in spam too.</p>
      <form id="otpForm" class="fields" novalidate>
        <div class="field"><label for="code">Confirmation code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div>
        <button class="btn btn-primary btn-wide">Confirm and start my free day</button>
        <p class="fan-msg ok" id="msg" role="alert">${esc(notice)}</p>
      </form>
      <button class="fan-link" id="resend" type="button">Send a new code</button>`);
    $('#otpForm').onsubmit = async (e) => {
      e.preventDefault();
      const code = $('#code').value.trim();
      if (!/^\d{6,10}$/.test(code)) { setMsg('Enter the numeric code from the email.'); return; }
      busy(e.target, true); setMsg('Checking…', 'ok');
      try { await FanAuth.verify(email, code); await afterLogin(); } catch (err) { setMsg(err.message); busy(e.target, false); }
    };
    $('#resend').onclick = async () => {
      try { await FanAuth.resend(email); setMsg('A new code is on its way.', 'ok'); } catch (err) { setMsg(err.message); }
    };
    $('#code').focus();
  }

  function forgot() {
    shell('Reset your password', `<form id="fForm" class="fields" novalidate>
        <div class="field"><label for="email">Email</label><input id="email" class="text" type="email" autocomplete="username" required></div>
        <button class="btn btn-primary btn-wide">Email me a reset code</button><p class="fan-msg err" id="msg" role="alert"></p></form>
      <button class="fan-link" id="back" type="button">Back to log in</button>`);
    $('#back').onclick = () => entry('login');
    $('#fForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#email').value;
      const problem = FanAuth.checkEmail(email);
      if (problem) { setMsg(problem); return; }
      busy(e.target, true);
      try { await FanAuth.recover(email); resetCode(email); } catch (err) { setMsg(err.message); busy(e.target, false); }
    };
  }
  function resetCode(email) {
    shell('Enter your reset code', `<p>If that email has an account, a code is on its way to it.</p><form id="rForm" class="fields" novalidate>
        <div class="field"><label for="code">Reset code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div>
        <div class="field"><label for="pw">New password</label><input id="pw" class="text" type="password" autocomplete="new-password" maxlength="72" required><small>At least 10 characters, with letters and numbers.</small></div>
        <button class="btn btn-primary btn-wide">Set new password</button><p class="fan-msg err" id="msg" role="alert"></p></form>`);
    $('#rForm').onsubmit = async (e) => {
      e.preventDefault();
      const pw = $('#pw').value, problem = FanAuth.checkPassword(pw);
      if (problem) { setMsg(problem); return; }
      busy(e.target, true);
      try { await FanAuth.verify(email, $('#code').value, 'recovery'); await FanAuth.setPassword(pw); await afterLogin(); } catch (err) { setMsg(err.message); busy(e.target, false); }
    };
  }

  function expired(info) {
    if (info && info.admin_login_needed) {
      shell('Login needed', `<p>This account opens Fan Pro only after its full login.</p>
        <a class="btn btn-primary btn-wide" style="text-align:center;text-decoration:none" href="fan-admin.html">Go to login</a>
        <button class="btn btn-wide" id="logoutBtn" type="button">Log out</button>`);
      $('#logoutBtn').onclick = async () => { await FanAuth.logOut(); entry('login'); };
      return;
    }
    const subject = encodeURIComponent('Fan Pro: please extend my access');
    const body = encodeURIComponent(`Hello,\n\nPlease extend Fan Pro access for ${FanAuth.email() || ''}.\n\nCompany:\nWhat I am designing:\n`);
    shell('Your Fan Pro time has ended', `
      <p>${info && info.access_until ? `Your access ended on ${esc(new Date(info.access_until).toLocaleString('en-IN'))}.` : 'This account does not have access yet.'} Your warnings and account are kept safely.</p>
      <p>Contact the admin for more time. The admin can give you the time you agree on, including a full month of Pro.</p>
      <a class="btn btn-primary btn-wide" style="text-align:center;text-decoration:none" href="mailto:${esc(ADMIN)}?subject=${subject}&body=${body}">Email the admin</a>
      <button class="btn btn-wide" id="logoutBtn" type="button">Log out</button>`);
    $('#logoutBtn').onclick = async () => { await FanAuth.logOut(); entry('login'); };
  }

  /* ---------- Access and engine ---------- */

  let access = null;
  async function sha256(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function loadEngine() {
    if (window.FanProCore) return;
    const rows = await FanAuth.rpc('fan_get_engine');
    const code = rows && rows.code;
    if (!code) throw new Error('The engine could not be loaded.');
    // Run the engine only if it is exactly the release this page was built for.
    if ((await sha256(code)) !== window.FAN_ENGINE_SHA256) throw new Error('The engine failed its safety check. Please contact the admin.');
    await new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([`${code}\nwindow.FanProCore = FanProCore;`], { type: 'text/javascript' }));
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => { URL.revokeObjectURL(url); res(); };
      s.onerror = () => rej(new Error('The engine could not start.'));
      document.head.append(s);
    });
  }
  async function afterLogin() {
    let info;
    try { info = await FanAuth.rpc('fan_my_access'); } catch (err) {
      if (err.status === 401 || err.status === 403) { await FanAuth.logOut(); entry('login', 'Please log in again.'); return; } // a stale or revoked login
      shell('Could not check your access', `<p>${esc(err.message)}</p><button class="btn btn-primary" id="retry" type="button">Try again</button>`);
      $('#retry').onclick = afterLogin;
      return;
    }
    access = info;
    if (!info || !info.active) { expired(info); return; }
    auth.hidden = true;
    auth.innerHTML = '<p>Loading Fan Pro…</p>';
    try { await loadEngine(); } catch (err) {
      shell('Could not open Fan Pro', `<p>${esc(err.message)}</p><button class="btn btn-primary" id="retry" type="button">Try again</button>`);
      $('#retry').onclick = afterLogin;
      return;
    }
    startTool();
    setInterval(recheck, 300000);
  }
  async function recheck() {
    try {
      const info = await FanAuth.rpc('fan_my_access');
      access = info;
      if (!info.active) { expired(info); return; }
      renderAccess();
    } catch { /* keep working through a short network gap */ }
  }

  /* ---------- Design tool ---------- */

  const STORE = 'traass_fanpro_state';
  const DEFAULTS = { flow: '200000', flowUnit: 'm3h', pressure: '4000', pressureUnit: 'pa', tempC: '120', coldC: '30', altitude: '0', gasDensityRatio: '1', dustId: 'filtered', dustLoad: '0', dustAbrasive: '1', dustSticky: '1', dustCorrosive: '1', dustExplosive: 'no', appId: 'bagho', ductLength: '50', ductVelocity: '', ductK: '2', ductAdd: true, flowMarginPct: '0', pressureMarginPct: '0', bladeId: '', driveMode: 'auto', inletMode: 'auto', hz: 50, sizes: '', arrangement: '', driveType: '', shaftMm: '', shaftMat: '', impellerMat: '', casingMat: '', safetyFactor: '1.5', motorMarginPct: '', coldStart: '', pick: null };
  let state = { ...DEFAULTS };
  let F, result = null, tab = 'selection', timer = 0;
  const logged = new Set();
  const TABS = [['selection', 'Selection'], ['triangles', 'Velocity diagrams'], ['impeller', 'Impeller and stress'], ['shaft', 'Shaft and motor'], ['casing', 'Casing'], ['cad', 'CAD'], ['log', 'Warning record'], ['method', 'Method']];

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE));
      if (raw && typeof raw === 'object') Object.keys(DEFAULTS).forEach((k) => { if (raw[k] !== undefined) state[k] = raw[k]; });
    } catch { /* start from the defaults */ }
  }
  const saveState = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* optional */ } };
  const pill = (s, l = {}) => `<span class="pill ${s}"><i aria-hidden="true">${{ ok: '✓', warn: '!', reject: '✕' }[s]}</i>${{ ok: l.ok || 'OK', warn: l.warn || 'Check', reject: l.reject || 'Fails' }[s]}</span>`;
  const options = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const field = (id, label, inner, hint = '') => `<div class="field"><label for="${id}">${label}</label>${inner}${hint ? `<small>${hint}</small>` : ''}</div>`;
  const input = (id, key, extra = 'inputmode="decimal"') => `<input id="${id}" data-k="${key}" value="${esc(state[key])}" ${extra}>`;
  const select = (id, key, list) => `<select id="${id}" data-k="${key}">${options(list, state[key])}</select>`;

  function groupOptions(items, val) {
    const groups = {};
    items.forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x); });
    return Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((x) => `<option value="${esc(x.id)}"${x.id === val ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
  }

  function startTool() {
    F = window.FanProCore;
    loadState();
    app.hidden = false;
    auth.hidden = true;
    const blades = [['', 'Use the suggestion'], ...Object.entries(F.BLADES).map(([k, b]) => [k, b.label])];
    const mats = [['', 'Use the suggestion'], ...Object.entries(F.MATERIALS).map(([k, m]) => [k, m.label])];
    app.innerHTML = `<div class="app">
      <header class="topbar">
        <div class="brand"><img src="favicon.svg" alt="TRAASS" style="height:34px;width:auto"><div><h1>Fan Pro</h1><p>Centrifugal fan design up to 10,000 kW</p></div></div>
        <div class="toolbar"><span id="accessPill" class="lock-note"></span>
          <button class="btn" id="saveJson" type="button">Save project</button><button class="btn" id="openJson" type="button">Open project</button><input id="jsonFile" type="file" accept=".json,application/json" hidden>
          ${(FanAuth.email() || '').toLowerCase() === ADMIN.toLowerCase() ? '<a class="btn" href="fan-admin.html">Admin</a>' : ''}
          <button class="btn" id="logout" type="button">Log out</button></div>
      </header>
      <aside class="side" aria-label="Duty">
        <section class="card fields"><h2>Duty</h2>
          ${field('iFlow', 'Airflow', `<div class="with-unit">${input('iFlow', 'flow')}${select('iFlowU', 'flowUnit', [['m3h', 'm³/h'], ['m3s', 'm³/s'], ['cfm', 'CFM']])}</div>`)}
          ${field('iP', 'Pressure, without the duct below', `<div class="with-unit">${input('iP', 'pressure')}${select('iPU', 'pressureUnit', [['pa', 'Pa'], ['mmwc', 'mmWC'], ['kpa', 'kPa'], ['inwg', 'in WG']])}</div>`, 'Fan total pressure.')}
          <div class="two">${field('iT', 'Operating temp (°C)', input('iT', 'tempC'))}${field('iC', 'Cold start (°C)', input('iC', 'coldC'))}</div>
          <div class="two">${field('iAlt', 'Altitude (m)', input('iAlt', 'altitude'))}${field('iGas', 'Gas ÷ air density', input('iGas', 'gasDensityRatio'))}</div>
          <p class="density" id="densityNote"></p>
        </section>
        <section class="card fields"><h2>Dust and application</h2>
          ${field('iDust', 'Dust type', `<select id="iDust" data-k="dustId">${groupOptions(F.DUSTS, state.dustId)}</select>`)}
          <div id="customDust"></div>
          ${field('iLoad', 'Dust load at the fan (g/m³)', input('iLoad', 'dustLoad'))}
          ${field('iApp', 'Application', `<select id="iApp" data-k="appId">${groupOptions(F.APPLICATIONS, state.appId)}</select>`)}
        </section>
        <details class="card" open><summary>Duct from the application</summary><div class="fields">
          <div class="two">${field('iDl', 'Duct length (m)', input('iDl', 'ductLength'))}${field('iDv', 'Velocity (m/s)', input('iDv', 'ductVelocity', 'inputmode="decimal" placeholder="auto"'))}</div>
          ${field('iDk', 'Bends and fittings, total K', input('iDk', 'ductK'))}
          <label style="font-size:14px"><input type="checkbox" id="iDa" ${state.ductAdd !== false ? 'checked' : ''}> Add the duct loss to the fan pressure</label>
          <p class="density" id="ductNote"></p>
        </div></details>
        <details class="card" open><summary>Blade type</summary><div class="fields">
          ${field('iBlade', 'Your choice', select('iBlade', 'bladeId', blades), 'A wrong choice gives a warning and is recorded.')}
        </div></details>
        <details class="card"><summary>Limits and options</summary><div class="fields">
          ${field('iDrive', 'Speed', select('iDrive', 'driveMode', [['auto', 'Best of direct or variable'], ['direct', 'Direct, fixed motor speed'], ['variable', 'Variable: VFD, belt or gearbox']]))}
          ${field('iIn', 'Inlets', select('iIn', 'inletMode', [['auto', 'Automatic'], ['single', 'Single inlet'], ['double', 'Double inlet']]))}
          <div class="two">${field('iHz', 'Supply', select('iHz', 'hz', [[50, '50 Hz'], [60, '60 Hz']]))}${field('iSf', 'Stress safety factor', input('iSf', 'safetyFactor'))}</div>
          <div class="two">${field('iFm', 'Flow margin (%)', input('iFm', 'flowMarginPct'))}${field('iPm', 'Pressure margin (%)', input('iPm', 'pressureMarginPct'))}</div>
          ${field('iSz', 'Standard sizes (mm)', `<textarea id="iSz" data-k="sizes" rows="2" placeholder="Default: 315 to 6300, R20 series">${esc(state.sizes)}</textarea>`, 'Enter your own range to replace the default.')}
          ${field('iMm', 'Motor margin (%)', input('iMm', 'motorMarginPct', 'inputmode="decimal" placeholder="auto"'))}
          ${field('iCs', 'Cold start', select('iCs', 'coldStart', [['', 'Automatic'], ['full', 'Full flow, motor sized for it'], ['controlled', 'Closed damper or VFD']]))}
        </div></details>
      </aside>
      <main class="main">
        <section class="card summary" id="summary" aria-live="polite"></section>
        <div><div class="tabs" role="tablist" aria-label="Design views">${TABS.map(([k, t]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${t}</button>`).join('')}</div></div>
        <section class="panel" id="panel"></section>
        <p class="notice"><b>Preliminary estimates only.</b> A failed wheel or shaft can kill people. A qualified engineer must check every result, with test data and FEA, before you quote, build or run a fan.</p>
      </main></div>`;
    bind();
    renderAccess();
    update();
  }

  function renderAccess() {
    const el = $('#accessPill');
    if (!el || !access) return;
    if (access.plan === 'superadmin') { el.textContent = 'Admin: full access'; return; }
    const left = new Date(access.access_until).getTime() - new Date(access.server_time || Date.now()).getTime();
    const hours = Math.max(left / 36e5, 0);
    el.textContent = `${access.plan === 'pro' ? 'Pro' : 'Pro trial'}: ${hours < 48 ? `${Math.ceil(hours)} hours` : `${Math.ceil(hours / 24)} days`} left`;
  }

  function bind() {
    app.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      state[k] = k === 'hz' ? Number(e.target.value) : e.target.value;
      if (['flow', 'pressure', 'tempC', 'dustId', 'appId', 'bladeId', 'inletMode', 'driveMode', 'hz', 'sizes'].includes(k)) state.pick = null;
      schedule();
    });
    app.addEventListener('click', (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; app.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === tb))); renderPanel(); return; }
      const row = t.closest('tr[data-d]');
      if (row) { state.pick = { D: Number(row.dataset.d), rpm: Number(row.dataset.r), inlets: Number(row.dataset.i) }; update(); return; }
      switch (t.id) {
        case 'iDa': state.ductAdd = t.checked; schedule(); break;
        case 'autoPick': state.pick = null; update(); break;
        case 'useBlade': state.bladeId = ''; syncField('iBlade', ''); update(); break;
        case 'logout': FanAuth.logOut().then(() => { app.hidden = true; entry('login'); }); break;
        case 'saveJson': saveFile(`${stem()}.json`, JSON.stringify(state, null, 2), 'application/json'); break;
        case 'openJson': $('#jsonFile').click(); break;
        case 'saveDxf': saveFile(`${stem()}-GA.dxf`, F.toDxf(cad()), 'application/dxf'); break;
        case 'saveSvg': saveFile(`${stem()}-GA.svg`, F.toSvg(cad(), { background: '#ffffff' }), 'image/svg+xml'); break;
        case 'printSheet': window.print(); break;
        default:
      }
    });
    $('#jsonFile').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f || f.size > 200000) { if (f) toast('That file is too large to be a project.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const next = { ...DEFAULTS };
          Object.keys(DEFAULTS).forEach((k) => { if (typeof raw[k] === 'string' || typeof raw[k] === 'number' || typeof raw[k] === 'boolean') next[k] = raw[k]; });
          state = next;
          startTool();
          toast(`Opened ${f.name}`);
        } catch { toast('That file is not a Fan Pro project.'); }
      };
      reader.readAsText(f);
    });
  }
  const syncField = (id, v) => { const el = $(`#${id}`); if (el) el.value = v; };
  const stem = () => `fan-${String(state.appId).replace(/\W+/g, '-')}`;
  function saveFile(name, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Saved ${name}`);
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 120); }

  function update() {
    result = F.design({ ...state, hz: Number(state.hz), shaftMm: state.shaftMm, sizes: state.sizes });
    saveState();
    renderSide();
    renderSummary();
    renderPanel();
    logWarnings();
  }

  // Keep the record to the choices a person made and to real safety issues, once each per visit.
  function logWarnings() {
    if (!result.flagsAll) return;
    const duty = { flow: state.flow, flowUnit: state.flowUnit, pressure: state.pressure, pressureUnit: state.pressureUnit, tempC: state.tempC, dust: state.dustId, app: state.appId, blade: result.bladeId };
    result.flagsAll.filter((f) => ['blade', 'shaft', 'material', 'arrangement'].includes(f.kind)).forEach((f) => {
      const key = `${f.kind}|${f.text}`;
      if (logged.has(key)) return;
      logged.add(key);
      FanAuth.rpc('fan_log_warning', { p_kind: f.kind, p_level: f.level, p_message: f.text.slice(0, 500), p_duty: duty }).catch(() => logged.delete(key));
    });
  }

  function renderSide() {
    const custom = $('#customDust');
    if (state.dustId === 'custom') {
      if (!custom.innerHTML) {
        custom.innerHTML = `<div class="fields">
          ${field('iAb', 'Abrasive, 0 to 3', input('iAb', 'dustAbrasive'))}
          ${field('iSt', 'Sticky, 0 to 2', input('iSt', 'dustSticky'))}
          ${field('iCo', 'Corrosive, 0 to 2', input('iCo', 'dustCorrosive'))}
          ${field('iEx', 'Can it explode?', select('iEx', 'dustExplosive', [['no', 'No'], ['yes', 'Yes']]))}</div>`;
      }
    } else custom.innerHTML = '';
    const note = $('#densityNote'), duct = $('#ductNote');
    if (result.errors.length) { note.textContent = ''; duct.textContent = ''; return; }
    note.innerHTML = `Working density <b>${fmt(result.rho, 3)} kg/m³</b>, design pressure <b>${fmt(result.dp)} Pa</b>`;
    duct.innerHTML = result.duct ? `Duct ${fmt(result.duct.dia * 1000)} mm at ${fmt(result.ductV, 0)} m/s, loss <b>${fmt(result.duct.loss)} Pa</b>` : '';
  }

  function renderSummary() {
    const el = $('#summary');
    if (result.errors.length) { el.innerHTML = `<h2>Check your inputs</h2><ul class="problems">${result.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`; return; }
    if (!result.row) {
      el.innerHTML = `<h2>No fan found for this duty</h2><p class="panel-lead">${esc(result.blade.label)} cannot meet this duty with the sizes and speeds allowed. Try another blade type, more sizes or a variable speed.</p>${flagsHtml(result.flags)}`;
      return;
    }
    const r = result.row, m = result.motor;
    el.innerHTML = `<div class="summary-head">${wheelIcon()}<div class="summary-title"><h2>${fmt(r.D * 1000)} mm ${esc(result.blade.label)}</h2>
        <p>${r.inlets === 2 ? 'Double inlet' : 'Single inlet'}, ${r.driveKind === 'direct' ? 'direct on motor speed' : 'variable speed'}, ${result.auto ? 'chosen as the best fit' : 'chosen by you'}</p></div>${pill(result.overall, { ok: 'Meets checks', warn: 'Check', reject: 'Fails a check' })}</div>
      <div class="stats">
        ${stat('Speed', fmt(r.rpm), 'rpm')}${stat('Efficiency', fmt(r.eta * 100, 1), '%')}${stat('Shaft power', fmt(r.kw, r.kw < 100 ? 1 : 0), 'kW')}${stat('Motor', m.motorKw ? fmt(m.motorKw, m.motorKw < 10 ? 1 : 0) : '–', 'kW')}${stat('Tip speed', fmt(r.u, 0), 'm/s')}${stat('Fan weight', fmt(result.totalKg / 1000, 1), 't')}
      </div>${flagsHtml(result.flagsAll)}`;
  }
  const stat = (k, v, u) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}<small>${u}</small></div></div>`;
  const flagsHtml = (list) => (list && list.length ? `<ul class="flags">${list.map((f) => `<li class="${esc(f.level)}">${esc(f.text)}</li>`).join('')}</ul>` : '');
  function wheelIcon() {
    const g = result.geo;
    const blades = [];
    const n = Math.min(g.z, 16);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI, sw = g.beta2 > 90 ? -0.5 : g.beta2 === 90 ? 0 : 0.5;
      blades.push(`<line x1="${(26 * Math.cos(a0)).toFixed(1)}" y1="${(26 * Math.sin(a0)).toFixed(1)}" x2="${(44 * Math.cos(a0 - sw)).toFixed(1)}" y2="${(44 * Math.sin(a0 - sw)).toFixed(1)}"/>`);
    }
    return `<svg class="impeller" viewBox="-50 -50 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle r="46"/><circle r="26"/>${blades.join('')}</g><circle r="6" fill="currentColor"/></svg>`;
  }

  function renderPanel() {
    const el = $('#panel');
    if (result.errors.length || !result.row) {
      if (tab === 'selection' && !result.errors.length) { el.innerHTML = adviceCard(); return; }
      if (tab === 'log') { renderLog(el); return; }
      if (tab === 'method') { el.innerHTML = methodHtml(); return; }
      el.innerHTML = '<div class="card"><p class="panel-lead">Fix the duty above to see this view.</p></div>';
      return;
    }
    ({ selection: viewSelection, triangles: viewTriangles, impeller: viewImpeller, shaft: viewShaft, casing: viewCasing, cad: viewCad, log: renderLog, method: (x) => { x.innerHTML = methodHtml(); } }[tab])(el);
  }

  function adviceCard() {
    const list = result.advice.list;
    return `<div class="card fields"><h3>Suggested blade type</h3><div class="advice">${list.slice(0, 4).map((a, i) => `<div class="advice-row ${a.id === result.suggested ? 'best' : ''}"><div><b>${esc(F.BLADES[a.id].label)}</b><small>${esc(a.reasons.slice(0, 2).join(' ') || 'Workable, with no strong reason for or against.')}</small></div>${a.id === result.suggested ? pill('ok', { ok: 'Suggested' }) : a.level !== 'ok' ? pill(a.level, { warn: 'Caution', reject: 'Avoid' }) : `<span class="lock-note">Option ${i + 1}</span>`}</div>`).join('')}</div>
      ${state.bladeId && state.bladeId !== result.suggested ? '<div class="row"><button class="btn" id="useBlade" type="button">Use the suggested blade</button></div>' : ''}</div>`;
  }
  function viewSelection(el) {
    const shown = result.rows.filter((r) => r.kw <= F.MAX_KW).slice(0, 18);
    const isPick = (r) => r.D === result.row.D && Math.abs(r.rpm - result.row.rpm) < 1 && r.inlets === result.row.inlets;
    el.innerHTML = `${adviceCard()}<div class="card fields"><div class="row space-between"><h3>Standard fan sizes that fit</h3>${result.auto ? '' : '<button class="btn" id="autoPick" type="button">Back to best choice</button>'}</div>
      <div class="table-wrap"><table><thead><tr><th>Size (mm)</th><th>Inlets</th><th class="n">Speed (rpm)</th><th>Drive</th><th class="n">Eff. (%)</th><th class="n">Power (kW)</th><th class="n">Tip (m/s)</th><th class="n">ψ</th><th class="n">φ</th><th>Status</th></tr></thead>
      <tbody>${shown.map((r) => `<tr class="pickable${isPick(r) ? ' picked' : ''}${r.status === 'reject' ? ' muted-row' : ''}" data-d="${r.D}" data-r="${r.rpm}" data-i="${r.inlets}" tabindex="0"><td>${fmt(r.D * 1000)}</td><td>${r.inlets === 2 ? 'Double' : 'Single'}</td><td class="n">${fmt(r.rpm)}</td><td>${r.driveKind === 'direct' ? 'Direct' : 'Variable'}</td><td class="n">${fmt(r.eta * 100, 1)}</td><td class="n">${fmt(r.kw, r.kw < 100 ? 1 : 0)}</td><td class="n">${fmt(r.u, 0)}</td><td class="n">${fmt(r.psi, 2)}</td><td class="n">${fmt(r.phi, 3)}</td><td>${pill(r.status, { ok: 'Fits' })}${r.flags[0] ? `<span class="why">${esc(r.flags[0].text)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="lock-note">Efficiency here is a typical figure for this wheel type, not a test result. Choose any row to see its design.</p></div>`;
  }

  function triangle(t, title, labelU, idx) {
    const W = 460, H = 250, pad = 76;
    const maxU = Math.max(t.u, t.cu, 1);
    const k = (W - 2 * pad) / maxU;
    const kY = Math.min(k, (H - 2 * pad - 22) / Math.max(t.cm, 1));
    const yBase = H - pad - 10;
    const O = [pad, yBase], U = [pad + t.u * k, yBase], A = [pad + t.cu * k, yBase - t.cm * kY];
    const mid = (a, b, dx = 0, dy = 0) => [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy];
    const ln = (a, b, c, extra = '') => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="2.4" ${extra}/>`;
    const lab = (p, s, anchor = 'middle') => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="${anchor}">${s}</text>`;
    const mU = mid(O, U, 0, 18), mC = mid(O, A, -10, -8), foot = [A[0], yBase];
    // Keep the labels apart when the triangle is narrow.
    const tight = U[0] - A[0] < 90;
    const mW = tight ? [U[0] + 8, A[1] + 14] : mid(U, A, 12, -8);
    return `<div class="card tri"><h3>${title}</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
      <defs><marker id="ar${idx}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor"/></marker></defs>
      ${ln(O, U, 'var(--series-3)', `marker-end="url(#ar${idx})"`)}${ln(O, A, 'var(--series-1)', `marker-end="url(#ar${idx})"`)}${ln(U, A, 'var(--series-2)', `marker-end="url(#ar${idx})"`)}
      ${ln(foot, A, 'var(--axis)', 'stroke-dasharray="5 4"')}
      ${lab(mU, `${labelU} = ${t.u.toFixed(1)} m/s`)}${lab(mC, `c = ${t.c.toFixed(1)}`, 'end')}${lab(mW, `w = ${t.w.toFixed(1)}`, 'start')}
      ${tight ? lab([A[0] - 6, (A[1] + yBase) / 2 + 4], `cm = ${t.cm.toFixed(1)}`, 'end') : lab([A[0] + 6, (A[1] + yBase) / 2], `cm = ${t.cm.toFixed(1)}`, 'start')}
      ${lab([O[0] + 34, yBase - 7], `α ${t.alpha.toFixed(0)}°`, 'start')}${lab([U[0] + 8, yBase + 4], `β ${t.beta.toFixed(0)}°`, 'start')}
    </svg></div>`;
  }
  function viewTriangles(el) {
    const g = result.geo;
    el.innerHTML = `<div class="tri-grid">${triangle(g.inlet, 'Inlet velocity triangle', 'u1', 1)}${triangle(g.outlet, 'Outlet velocity triangle, with slip', 'u2', 2)}</div>
      <div class="split"><div class="card"><h3>Wheel dimensions</h3>${rows([['Outer diameter D2', `${fmt(g.D2 * 1000)} mm`], ['Eye diameter D1', `${fmt(g.D1 * 1000)} mm`], ['Outlet width b2, per inlet', `${fmt(g.b2 * 1000)} mm`], ['Inlet width b1', `${fmt(g.b1 * 1000)} mm`], ['Number of blades', g.z], ['Blade inlet angle β1', `${fmt(g.beta1, 1)}°`], ['Blade outlet angle β2', `${fmt(g.beta2, 1)}°`]])}</div>
      <div class="card"><h3>Flow checks</h3>${rows([['Flow per inlet', `${fmt(result.qTotal / result.row.inlets, 2)} m³/s`], ['Flow coefficient φ', fmt(result.row.phi, 3)], ['Pressure coefficient ψ', fmt(result.row.psi, 2)], ['Slip factor (Wiesner)', fmt(g.sigma, 3)], ['Swirl at outlet cu2', `${fmt(g.outlet.cu, 1)} m/s`], ['Euler pressure', `${fmt(g.eulerDp)} Pa`], ['Hydraulic efficiency, estimated', `${fmt(g.etaH * 100, 0)} %`], ['Deceleration w2 ÷ w1', fmt(g.deHaller, 2)]])}</div></div>
      <p class="notice">Triangles use the centrifugal fan convention: u is blade speed, w is velocity relative to the blade, c is absolute velocity. Inlet flow is taken with no pre-swirl.</p>`;
  }
  const rows = (list) => `<div class="table-wrap"><table><tbody>${list.map(([k, v, s]) => `<tr><td>${k}</td><td class="n">${v}</td>${s ? `<td>${pill(s)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;

  function materialPicker(id, key, suggest) {
    const list = [['', `Suggested: ${F.MATERIALS[suggest].label}`], ...Object.entries(F.MATERIALS).map(([k, m]) => [k, `${m.label}, up to ${m.tMax} °C`])];
    return field(id, 'Material', select(id, key, list));
  }
  function viewImpeller(el) {
    const s = result.stress;
    el.innerHTML = `<div class="split"><div class="card fields"><h3>Impeller material</h3>${materialPicker('iMatI', 'impellerMat', result.materialSuggestion.impeller)}
        ${rows([['Yield at operating temperature', `${fmt(s.sy, 0)} MPa`], ['Safety factor on yield', fmt(s.safety, 2)], ['Allowed stress', `${fmt(s.allow, 0)} MPa`], ['Checked at overspeed', `${fmt(s.overspeed * 100)} %`], ['Wear and corrosion allowance', `${fmt(s.wearAllowance, 1)} mm`]])}
        <h3>Plate thickness</h3>${rows([['Blade', `${s.tBlade} mm`], ['Backplate', `${s.tBack} mm`], ['Shroud', s.tShroud ? `${s.tShroud} mm` : 'Open wheel']])}</div>
      <div class="card fields"><h3>Stress at overspeed</h3><div class="table-wrap"><table class="result-table"><thead><tr><th>Check</th><th class="n">Stress (MPa)</th><th class="n">Used</th><th></th></tr></thead><tbody>${s.checks.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${fmt(c.value)}</td><td class="n">${fmt(c.ratio * 100)} %</td><td>${pill(c.ratio > 1 ? 'reject' : c.ratio > 0.85 ? 'warn' : 'ok')}</td></tr>`).join('')}</tbody></table></div>
        <h3>Masses</h3>${rows([['Blades', `${fmt(s.bladeKg)} kg`], ['Backplate', `${fmt(s.backKg)} kg`], ['Shroud', `${fmt(s.shroudKg)} kg`], ['Hub and welds, estimated', `${fmt(s.hubKg)} kg`], ['Wheel total', `${fmt(s.totalKg)} kg`], ['Wheel inertia', `${fmt(s.inertia)} kg·m²`]])}</div></div>
      <p class="notice"><b>This is a hand-calculation screen, not FEA.</b> It uses rotating-disc and beam formulas, without weld, stress-raiser or fatigue effects. Large or fast wheels need FEA, weld design, and spin and balance checks.</p>`;
  }
  function viewShaft(el) {
    const s = result.shaft, m = result.motor, st = result.start;
    el.innerHTML = `<div class="split"><div class="card fields"><h3>Your choices</h3>
        ${field('iArr', 'Arrangement', select('iArr', 'arrangement', [['', `Automatic: ${s.arrangement === 'centre' ? 'between bearings' : 'overhung'}`], ['overhung', 'Overhung wheel'], ['centre', 'Between bearings']]))}
        ${field('iDt', 'Drive', select('iDt', 'driveType', [['', `Automatic: ${result.driveType}`], ['coupling', 'Coupling'], ['belt', 'Belt']]))}
        ${field('iSm', 'Shaft material', select('iSm', 'shaftMat', [['', 'Automatic'], ...Object.entries(F.SHAFT_MATERIALS).map(([k, v]) => [k, v.label])]))}
        ${field('iSd', 'Shaft diameter (mm)', input('iSd', 'shaftMm', `inputmode="decimal" placeholder="auto ${s.autoMm}"`), 'A diameter below the need gives a warning and is recorded.')}</div>
      <div class="card fields"><h3>Shaft selection</h3><div class="table-wrap"><table class="result-table"><tbody>
        <tr><td>Material</td><td class="n">${esc(s.material)}</td><td></td></tr>
        <tr><td>Torque at motor rating</td><td class="n">${fmt(s.torque)} N·m</td><td></td></tr>
        <tr><td>Bending moment, with dynamic allowance</td><td class="n">${fmt(s.bendingMoment)} N·m</td><td></td></tr>
        <tr><td>Smallest diameter for strength</td><td class="n">${fmt(s.needMm)} mm</td><td></td></tr>
        <tr><td>Standard shaft${s.auto ? ', automatic' : ', your entry'}</td><td class="n">${fmt(s.mm)} mm</td><td>${pill(s.mm < s.needMm ? 'reject' : 'ok')}</td></tr>
        <tr><td>Shear stress against allowed</td><td class="n">${fmt(s.stressShear, 0)} / ${fmt(s.ssAllow, 0)} MPa</td><td></td></tr>
        <tr><td>First critical speed</td><td class="n">${fmt(s.criticalRpm)} rpm</td><td></td></tr>
        <tr><td>Margin above running speed</td><td class="n">${fmt(s.marginPct)} %</td><td>${pill(s.marginPct < s.minMarginPct ? 'reject' : 'ok')}</td></tr>
        <tr><td>Overhang and bearing span</td><td class="n">${s.arrangement === 'overhung' ? `${fmt(s.overhang, 2)} m, ` : ''}${fmt(s.span, 2)} m</td><td></td></tr></tbody></table></div></div>
      <div class="card fields"><h3>Motor and start</h3>${rows([['Running power', `${fmt(m.kw, m.kw < 100 ? 1 : 0)} kW`], ['Cold-start power at full flow', `${fmt(m.coldKw, m.kw < 100 ? 1 : 0)} kW`], ['Cold start method', m.coldStart === 'controlled' ? 'Closed damper or VFD' : 'Full flow'], ['Motor needed', `${fmt(m.requiredKw, m.kw < 100 ? 1 : 0)} kW`], ['Motor selected', m.motorKw ? `${fmt(m.motorKw, m.motorKw < 10 ? 1 : 0)} kW, ${esc(m.voltage)}` : 'None up to 10,000 kW'], ['Motor speed', `${fmt(m.motorRpm)} rpm`], ['Starting time, estimated', st ? (st.seconds === null ? 'Cannot start' : `${fmt(st.seconds, 0)} s`) : '–'], ['Inertia at motor shaft', st ? `${fmt(st.J)} kg·m²` : '–']])}</div></div>
      <p class="notice">Not included: bearing life, torsional analysis of the drive train, fatigue at keyways and steps, or foundation design. Motor inertia is estimated until you have the data sheet.</p>`;
  }
  function viewCasing(el) {
    const c = result.casing;
    el.innerHTML = `<div class="split"><div class="card fields"><h3>Casing material</h3>${materialPicker('iMatC', 'casingMat', result.materialSuggestion.casing)}
        <h3>Plate thickness</h3>${rows([['Scroll, with wear allowance', `${c.tScroll} mm`], ['Side plates', `${c.tSide} mm`], ['Pressure case', `${fmt(c.pDesign)} Pa`], ['Thickness from pressure alone', `${fmt(c.tPressure, 1)} mm`], ['Stiffener spacing', `${fmt(c.stiffenerSpacing * 1000)} mm`], ['Allowance for wear and corrosion', `${fmt(c.wearAllowance, 0)} mm`], ['Casing weight, with stiffeners', `${fmt(c.casingKg)} kg`]])}</div>
      <div class="card fields"><h3>Scroll proportions</h3>${rows([['Inside width', `${fmt(c.width * 1000)} mm`], ['Start radius at the cut-off', `${fmt(c.r3 * 1000)} mm`], ['Largest radius', `${fmt(c.rOut * 1000)} mm`], ['Outlet', `${fmt(c.outletH * 1000)} × ${fmt(c.width * 1000)} mm`], ['Outlet velocity', `${fmt(c.outletV, 1)} m/s`], ['Cut-off clearance', `${fmt(c.cutoffClearance * 1000)} mm`]])}
        <h3>Construction</h3><p>${esc(c.liner)}</p><ul class="flags">${c.accessories.map((a) => `<li style="border-left-color:var(--axis)">${esc(a)}</li>`).join('')}</ul></div></div>
      <p class="notice">Plate thickness uses a flat-plate bending formula between stiffeners. Check buckling, the frame, nozzle loads and any explosion-rated requirement separately.</p>`;
  }
  const cad = () => F.fanCad(result, [`${F.APPLICATIONS.find((a) => a.id === state.appId).name}: ${fmt(result.row.rpm)} rpm, ${fmt(result.qTotal * 3600)} m3/h, ${fmt(result.dp)} Pa, ${state.tempC} C`]);
  function viewCad(el) {
    el.innerHTML = `<div class="card fields"><div class="row space-between"><p class="panel-lead">General arrangement drawn to scale from this calculation: front view with the blades and scroll, and a section through the shaft.</p>
        <div class="row"><button class="btn btn-primary" id="saveDxf" type="button">Save DXF for CAD</button><button class="btn" id="saveSvg" type="button">Save SVG</button></div></div>
        <div class="drawing">${F.toSvg(cad(), { stroke: 'currentColor', textFill: 'currentColor' })}</div>
        <p class="notice"><b>Not for manufacture.</b> This is a preliminary layout. Blade shape, scroll and welds still need detail design. DXF layers: CASING, IMPELLER, BLADES, SHAFT, CENTRE, DIMS and TEXT.</p></div>`;
  }
  async function renderLog(el) {
    el.innerHTML = '<div class="card">Loading your record…</div>';
    try {
      const list = await FanAuth.rpc('fan_my_warnings');
      el.innerHTML = `<div class="card fields"><h3>Warnings recorded on your account</h3><p class="lock-note">When a choice goes against the suggestion, it is saved here with its duty, for future reference.</p>
        <div class="table-wrap"><table><thead><tr><th>When</th><th>Type</th><th>Warning</th><th>Duty</th></tr></thead><tbody>${list.map((w) => {
          const d = w.duty || {};
          return `<tr><td>${esc(new Date(w.created_at).toLocaleString('en-IN'))}</td><td>${esc(w.kind)}</td><td>${esc(w.message)}</td><td>${esc(d.flow)} ${esc(d.flowUnit)}, ${esc(d.pressure)} ${esc(d.pressureUnit)}, ${esc(d.tempC)} °C, ${esc(d.dust)}</td></tr>`;
        }).join('') || '<tr><td colspan="4">No warnings recorded yet.</td></tr>'}</tbody></table></div></div>`;
    } catch (err) { el.innerHTML = `<div class="card">${esc(err.message)}</div>`; }
  }
  function methodHtml() {
    return `<div class="card method">
      <p><b>Fan Pro gives preliminary estimates.</b> It is built from published fan laws and strength formulas, and no fan built from these results has been tested. Have a qualified engineer confirm every figure.</p>
      <h3>Sizing</h3><div class="formula">ψ = Δp / (½ρu²)     φ = Q / ((π/4) D² u)     u = π D N / 60
Power = Q Δp Kp / η     Kp = 1 − Δp / (2γ p_inlet)</div>
      <p>Each wheel type has a typical range of ψ, φ and efficiency, and each standard size and speed is checked against that range. These are representative figures, not any maker's test data. Replace them with tested curves before you guarantee performance.</p>
      <h3>Velocity triangles</h3><div class="formula">cu2 = σ (u2 − cm2 / tan β2)     Δp_Euler = ρ u2 cu2
σ = 1 − √(sin β2) / z^0.7  (Wiesner)     D1/D2 ≈ 1.194 φ^(1/3)</div>
      <h3>Impeller stress</h3><div class="formula">σ_disc = ρ ω² ((3+ν) r2² + (1−ν) r1²) / 4
σ_blade = k ρ ω² r n b² / t     k = ½ fixed both ends, 3 cantilever</div>
      <p>Checked at ${fmt(110)} % overspeed, with yield reduced for temperature. Material figures are indicative, so use your mill certificates.</p>
      <h3>Shaft</h3><div class="formula">d³ = 16 / (π τ) × √((Km M)² + (Kt T)²)     Km 1.5, Kt 1.0
τ = min(0.3 Sy, 0.18 UTS) × 0.75, for a keyway
1/Nc² = 1/N_wheel² + 1/N_shaft², then × 0.85 for bearing flexibility</div>
      <h3>Duct and casing</h3><div class="formula">Δp = (f L/D + ΣK) ½ρv²     f from Swamee-Jain
t = b √(0.5 p / σ) + wear and corrosion allowance</div>
      <h3>References</h3><ul><li><a href="https://tcf.com/fanpedia/" target="_blank" rel="noopener">Twin City Fan, FanPedia</a>, for wheel types and construction terms</li><li><a href="https://cfturbo.com/services/training-courses" target="_blank" rel="noopener">CFturbo training outline</a>, for the order of the design steps</li><li>Standard textbook relations: fan laws, Euler equation, Wiesner slip, rotating-disc stress, ASME shaft code, Darcy friction</li></ul>
      <h3>What it does not do</h3><ul><li>CFD, FEA, rotor dynamics or fatigue life</li><li>Bearing life and foundation loads</li><li>Certify anything against AMCA, ISO, ATEX or PESO rules</li></ul>
      <p class="notice">"All dust" means the common industrial dusts listed, plus an Other option where you set the classes. Test your actual dust when wear or explosion risk matters. This tool has no link to any fan maker or software vendor, and uses none of their data or code.</p></div>`;
  }

  /* ---------- Start ---------- */

  if (!FanAuth.ready()) {
    shell('Fan Pro is being set up', '<p>Accounts open soon. You can use the trial version now, or contact the admin for early access.</p>');
  } else if (FanAuth.hasSession()) afterLogin();
  else entry();
})();
