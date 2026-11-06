/* Fan Pro screens: account forms first, then the design tool once the server grants access.
   No calculation is on this website. Every number comes from the private server, for logged-in people with access. */
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
      <a class="fan-back" href="index.html">← Back to the website</a>${foot}`;
  }
  const setMsg = (text, kind = 'err') => { const m = $('#msg'); if (m) { m.textContent = text; m.className = `fan-msg ${kind}`; } };
  function busy(form, on) { form.querySelectorAll('button').forEach((b) => { b.disabled = on; }); }

  function entry(mode = 'login', notice = '') {
    const signup = false; // accounts are created only by the admin
    shell(signup ? 'Create your Fan Pro account' : 'Log in to Fan Pro', `
      
      ${signup ? '<p class="lock-note">Your first day of Fan Pro is free. We email you a code to confirm your address.</p>' : ''}
      <form id="entryForm" class="fields" novalidate>
        <div class="field"><label for="email">Email</label><input id="email" class="text" type="email" autocomplete="username" required maxlength="254"></div>
        <div class="field"><label for="pw">Password</label><input id="pw" class="text" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required maxlength="72">${signup ? '<small>At least 10 characters, with letters and numbers.</small>' : ''}</div>
        <button class="btn btn-primary btn-wide">${signup ? 'Create account and send code' : 'Log in'}</button>
        <p class="fan-msg ${notice ? 'ok' : 'err'}" id="msg" role="alert">${esc(notice)}</p>
      </form>
      ${signup ? '' : '<button class="fan-link" id="forgot" type="button">Forgot your password?</button>'}`);
    if (!signup) $('#forgot').onclick = forgot;
    $('#entryForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#email').value, pw = $('#pw').value;
      if (FanAuth.adminEmail(email)) { location.href = 'fan-admin.html'; return; } // the superadmin is made in the database: no signup, no confirmation email
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
  const apiBase = () => String((window.FAN_CONFIG && window.FAN_CONFIG.apiUrl) || '').replace(/\/+$/, '');
  /* One call to the private server. asBlob returns a file. */
  async function api(path, body, asBlob = false) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 90000); // a sleeping server can take a while to wake
    try {
      const r = await fetch(apiBase() + path, {
        method: body === undefined ? 'GET' : 'POST', signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Authorization: `Bearer ${await FanAuth.accessToken()}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        const err = new Error(typeof d.detail === 'string' ? d.detail : 'The server could not answer. Please try again.');
        err.status = r.status;
        throw err;
      }
      return asBlob ? r.blob() : r.json();
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('Could not reach the calculation server. It may be starting up, so please try again in a minute.');
      throw e;
    } finally { clearTimeout(t); }
  }
  async function loadEngine() {
    if (!apiBase()) throw new Error('The calculation server is not connected yet. Please contact the admin.');
    if (!F) F = await api('/api/meta');
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
  const tabList = () => [['full', 'Full design'], ...TABS.slice(0, 6), ['curve', 'Performance curve'], ['start', 'Start conditions'], ['standards', 'Standards checks'], ['outputs', '3D and reports'], ...TABS.slice(6)];
  // What each view needs from the server, so a change only recalculates what is on screen.
  const SECTIONS = { curve: ['analysis'], start: ['start'], standards: ['analysis', 'standards'], outputs: ['analysis', 'outputs'], cad: ['cad'], full: ['sheet'] };
  const SECTION_KEY = { analysis: 'analysis', start: 'start', standards: 'standards', outputs: 'outputs', cad: 'cadSvg', sheet: 'sheet' };
  let bundle = {}, seq = 0, inFlight = false;
  const FA_KEY = 'traass_fan_analysis_options';
  let faOpts = { slip: 'legacy', casingType: 'volute', category: 'D', gapRatio: '', sefCoefficient: '', fixedPa: '', diffuserAreaRatio: '', profile: '', rhPct: '', baroPa: '', bearingType: 'roller', cA: '', cB: '', volute: 'constantMomentum', stGas: 'cold', stDust: 'clean', stDamper: 'closed', stMethod: 'dol', stDustLoad: '', stClosedPct: '', mLrt: '', mPut: '', mBdt: '', mLrc: '', mJ: '', mV: '', mStallHot: '', mStallCold: '', stSoft: '', stRamp: '', stVfdT: '', dBox: 'no', dBoxK: '', dBoxArea: '', dDamper: 'none', dDamperK: '', dSil: 'none', dSilFill: 'rock', dSilMoc: 'ms', dSilLen: '', dSilOpen: '', dSilGap: '', dSilFace: '', dSilDb: '', dMoc: '', dOver: '', dSpan: '', dTail: '', dCoupKg: '', dWheelD: '', dNdeD: '', dDeD: '', dBodyD: '', dCoupD: '', dMargin: '', dHub: '', dHubOd: '', dHubLen: '', dHubRating: '', dHubInterf: '', dLocating: 'de', dTarget: '', dHours: '', dThrust: '', deType: 'srb', deBrand: 'SKF', deDes: '', deC: '', deC0: '', deN: '', deY: '', deOd: '', deW: '', ndeType: 'srb', ndeBrand: 'SKF', ndeDes: '', ndeC: '', ndeC0: '', ndeN: '', ndeY: '', ndeOd: '', ndeW: '', dLube: '', dBrgTemp: '', cLabour: '', cGrease: '', cOil: '', cBearing: '', cPower: '' };
  try { faOpts = { ...faOpts, ...JSON.parse(localStorage.getItem(FA_KEY) || '{}') }; } catch { /* defaults */ }
  let faCoefficients = null;

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
    loadState();
    app.hidden = false;
    auth.hidden = true;
    const blades = [['', 'Use the suggestion'], ...Object.entries(F.BLADES).map(([k, b]) => [k, b.label])];
    const mats = [['', 'Use the suggestion'], ...Object.entries(F.MATERIALS).map(([k, m]) => [k, m.label])];
    app.innerHTML = `<div class="app">
      <header class="topbar">
        <div class="brand"><img src="favicon.svg" alt="TRAASS" style="height:34px;width:auto"><div><h1>Fan Pro</h1><p>Centrifugal fan design up to 10,000 kW</p></div></div>
        <div class="toolbar"><span id="calcStatus" class="lock-note" aria-live="polite"></span><span id="accessPill" class="lock-note"></span>
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
        <div><div class="tabs" role="tablist" aria-label="Design views">${tabList().map(([k, t]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${t}</button>`).join('')}</div></div>
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
    el.textContent = `${access.plan === 'pro' ? 'Pro' : 'Basic'}: ${hours < 48 ? `${Math.ceil(hours)} hours` : `${Math.ceil(hours / 24)} days`} left`;
  }

  function bind() {
    app.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      state[k] = k === 'hz' ? Number(e.target.value) : e.target.value;
      if (['flow', 'pressure', 'tempC', 'dustId', 'appId', 'bladeId', 'inletMode', 'driveMode', 'hz', 'sizes'].includes(k)) state.pick = null;
      schedule();
    });
    app.addEventListener('change', (e) => {
      const key = e.target.dataset.fa;
      if (!key) return;
      faOpts[key] = e.target.value;
      try { localStorage.setItem(FA_KEY, JSON.stringify(faOpts)); } catch { /* lasts this visit only */ }
      update();
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
        case 'saveDxf': serverFile('ga-dxf', `${stem()}-GA.dxf`); break;
        case 'saveSvg': serverFile('ga-svg', `${stem()}-GA.svg`); break;
        case 'printSheet': window.print(); break;
        case 'saveStl': serverFile('stl', `${stem()}-impeller.stl`); break;
        case 'saveStep': serverFile('step', `${stem()}-impeller.stp`); break;
        case 'saveFlat': serverFile('flat', `${stem()}-flat-patterns.dxf`); break;
        case 'saveFea': serverFile('fea', `${stem()}-fea-handoff.json`); break;
        case 'saveXlsx': serverFile('xlsx', `${stem()}-calculation.xlsx`); break;
        case 'saveDocx': serverFile('docx', `${stem()}-report.docx`); break;
        case 'loadCoef': $('#coefFile').click(); break;
        case 'clearCoef': faCoefficients = null; update(); break;
        default:
      }
    });
    app.addEventListener('change', (e) => {
      if (e.target.id !== 'coefFile' || !e.target.files[0]) return;
      const f = e.target.files[0];
      if (f.size > 200000) { toast('That file is too large to be a coefficient set.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const set = raw.coefficientSet || raw;
          const terms = F.LOSS_TERMS;
          if (!set.multipliers || !terms.every((t) => Number.isFinite(set.multipliers[t]) && set.multipliers[t] > 0 && set.multipliers[t] < 10)) throw new Error('bad');
          faCoefficients = { version: String(set.version || ''), datasetHash: String(set.datasetHash || ''), multipliers: Object.fromEntries(terms.map((t) => [t, set.multipliers[t]])), hold: raw.metrics?.hold, intervals: raw.intervals };
          toast(`Loaded coefficient set ${faCoefficients.version}`);
          update();
        } catch { toast('That file is not a Fan Pro coefficient set.'); }
      };
      reader.readAsText(f);
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
  async function serverFile(kind, name) {
    toast('Preparing the file…');
    try { saveFile(name, await api(`/api/file/${kind}`, faPayload([]), true)); } catch (err) { toast(err.message); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 350); }

  /* Sends the inputs to the server and shows the answer. Only the newest answer is used. */
  async function update() {
    const mine = ++seq;
    inFlight = true;
    const status = $('#calcStatus');
    if (status) status.textContent = 'Calculating…';
    try {
      const out = await api('/api/compute', faPayload(SECTIONS[tab] || []));
      if (mine !== seq) return;
      bundle = out;
      result = out.design;
      if (status) status.textContent = '';
      saveState();
      renderSide();
      renderSummary();
      renderPanel();
      logWarnings();
    } catch (err) {
      if (mine !== seq) return;
      if (status) status.textContent = '';
      if (err.status === 401) { await FanAuth.logOut(); app.hidden = true; entry('login', 'Please log in again.'); return; }
      if (err.status === 403) { recheck(); return; }
      toast(err.message);
      if (!result) $('#panel').innerHTML = `<div class="card"><p class="panel-lead">${esc(err.message)}</p><button class="btn btn-primary" type="button" id="retryCalc">Try again</button></div>`;
      const retry = $('#retryCalc');
      if (retry) retry.onclick = update;
    } finally { if (mine === seq) inFlight = false; }
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
    if (!result) { el.innerHTML = '<div class="card"><p class="panel-lead">Calculating…</p></div>'; return; }
    if (result.errors.length || !result.row) {
      if (tab === 'selection' && !result.errors.length) { el.innerHTML = adviceCard(); return; }
      if (tab === 'log') { renderLog(el); return; }
      if (tab === 'method') { el.innerHTML = methodHtml(); return; }
      el.innerHTML = '<div class="card"><p class="panel-lead">Fix the duty above to see this view.</p></div>';
      return;
    }
    const missing = (SECTIONS[tab] || []).some((s) => bundle[SECTION_KEY[s]] === undefined);
    if (missing) {
      el.innerHTML = '<div class="card"><p class="panel-lead">Calculating…</p></div>';
      if (!inFlight) update();
      return;
    }
    ({ full: viewFull, selection: viewSelection, triangles: viewTriangles, impeller: viewImpeller, shaft: viewShaft, casing: viewCasing, cad: viewCad, curve: viewCurve, start: viewStart, standards: viewStandards, outputs: viewOutputs, log: renderLog, method: (x) => { x.innerHTML = methodHtml(); } }[tab])(el);
  }

  /* ---------- Performance curve, standards checks, 3D and reports ---------- */
  const faNum = (v) => { const n = Number(v); return v !== '' && Number.isFinite(n) ? n : undefined; };
  function faOptions() {
    return {
      slip: faOpts.slip, casingType: faOpts.casingType, category: faOpts.category,
      ...(faNum(faOpts.gapRatio) ? { gapRatio: faNum(faOpts.gapRatio) / 100 } : {}),
      ...(faNum(faOpts.diffuserAreaRatio) ? { diffuserAreaRatio: faNum(faOpts.diffuserAreaRatio) } : {}),
      sefCoefficient: faNum(faOpts.sefCoefficient) ?? 0, fixedPa: faNum(faOpts.fixedPa) ?? 0, bearingType: faOpts.bearingType,
      catalogueC: { ...(faNum(faOpts.cA) ? { 'A (wheel end)': faNum(faOpts.cA) } : {}), ...(faNum(faOpts.cB) ? { B: faNum(faOpts.cB) } : {}) },
    };
  }
  function faSheet() {
    const v = (k) => faNum(faOpts[k]);
    const brg = (p) => ({ type: faOpts[`${p}Type`], brand: faOpts[`${p}Brand`], designation: faOpts[`${p}Des`], c: v(`${p}C`), c0: v(`${p}C0`), nLimit: v(`${p}N`), y: v(`${p}Y`), od: v(`${p}Od`), width: v(`${p}W`), bore: undefined });
    const temp = v('dBrgTemp');
    return {
      inletBox: faOpts.dBox, boxK: v('dBoxK'), boxAreaM2: v('dBoxArea'), damper: faOpts.dDamper, damperK: v('dDamperK'), silencer: faOpts.dSil, silFill: faOpts.dSilFill, silMoc: faOpts.dSilMoc, silLength: v('dSilLen'), silOpen: v('dSilOpen'), silGap: v('dSilGap'), silFaceV: v('dSilFace'), silMakerDb: v('dSilDb'),
      shaftMoc: faOpts.dMoc, overhang: v('dOver'), span: v('dSpan'), tail: v('dTail'), couplingKg: v('dCoupKg'), dWheel: v('dWheelD'), dNde: v('dNdeD'), dDe: v('dDeD'), dBody: v('dBodyD'), dCoupling: v('dCoupD'), minMargin: v('dMargin'),
      hubType: faOpts.dHub, hubOd: v('dHubOd'), hubLen: v('dHubLen'), hubBushRatingNm: v('dHubRating'), hubInterference: v('dHubInterf'),
      locating: faOpts.dLocating, target: v('dTarget'), hoursYear: v('dHours'), thrustN: v('dThrust'), de: brg('de'), nde: brg('nde'), lube: faOpts.dLube, ...(temp === undefined ? {} : { bearingTempC: temp }),
      labourRate: v('cLabour'), greaseRate: v('cGrease'), oilRate: v('cOil'), bearingCost: v('cBearing'), powerRate: v('cPower'),
    };
  }
  /* Everything the server needs for one answer. */
  function faPayload(sections) {
    const v = (k) => faNum(faOpts[k]);
    return {
      state: { ...state, hz: Number(state.hz) }, sections, opts: faOptions(), profile: faOpts.profile, sheet: faSheet(), standards: { rhPct: v('rhPct'), baroPa: v('baroPa'), volute: faOpts.volute },
      startSel: { gas: faOpts.stGas, dust: faOpts.stDust, damper: faOpts.stDamper, method: faOpts.stMethod },
      startOpts: { startDustLoad: v('stDustLoad') ?? (Number(state.dustLoad) || 0), closedPowerPct: v('stClosedPct'), softLimit: v('stSoft'), vfdRamp: v('stRamp'), vfdTorqueLimit: v('stVfdT'), motor: { lrt: v('mLrt'), put: v('mPut'), bdt: v('mBdt'), lrc: v('mLrc'), inertia: v('mJ'), voltage: v('mV'), stallHot: v('mStallHot'), stallCold: v('mStallCold') } },
      ...(faCoefficients ? { coefficients: faCoefficients } : {}),
    };
  }
  const faText = (key, label, placeholder = '') => `<div class="field"><label for="fa_${key}">${esc(label)}</label><input id="fa_${key}" class="text" data-fa="${key}" maxlength="40" value="${esc(faOpts[key])}" placeholder="${esc(placeholder)}"></div>`;
  const faPairs = (o) => Object.entries(o);

  /* ---------- One page: every selection, its effect and its warnings ---------- */
  function viewFull(el) {
    const d = bundle.sheet, s = bundle.start, acc = d.accessories, sh = d.shaft, hub = d.hub, br = d.bearings, lu = d.lube, mt = d.maintenance;
    const word = { ok: 'OK', warn: 'Check', reject: 'Not suitable' };
    const money = (v) => (v === null || v === undefined ? 'Enter rates' : `₹ ${fmt(v, 0)}`);
    const bearingInputs = (p, b) => `<div class="fields"><h3>${esc(b.name)}</h3><div class="two">
        ${faSelect(`${p}Type`, 'Bearing type', faPairs(F.BEARING_TYPES))}${faSelect(`${p}Brand`, 'Make', F.BEARING_BRANDS.map((x) => [x, x]))}
        ${faText(`${p}Des`, 'Designation', b.candidates[0] || 'from catalogue')}${faInput(`${p}C`, 'C, dynamic rating (kN)', 'from catalogue')}
        ${faInput(`${p}C0`, 'C0, static rating (kN)', 'from catalogue')}${faInput(`${p}N`, 'Limiting speed (rpm)', 'from catalogue')}
        ${faInput(`${p}Y`, 'Axial factor Y', String(b.y))}${faInput(`${p}Od`, 'Outer diameter D (mm)', 'from catalogue')}${faInput(`${p}W`, 'Width B (mm)', 'from catalogue')}
      </div><p class="lock-note">Seat ${fmt(b.seatMm)} mm. Series that fit this bore: ${esc(b.candidates.join(', ') || 'none in the usual numbering')}. Check the exact designation and suffix in your catalogue.</p></div>`;
    const bearingResult = (b) => [b.name, `${b.brand} ${b.typeLabel} ${b.designation}`.trim(), fmt(b.frN / 1000, 1), fmt(b.faN / 1000, 1), fmt(b.pN / 1000, 1), fmt(b.needCkN, 0), b.cKn ? fmt(b.cKn, 0) : 'Enter C', b.l10h ? fmt(b.l10h, 0) : 'Not calculated', b.l10Years ? fmt(b.l10Years, 1) : '–', b.s0 ? fmt(b.s0, 1) : '–', b.speedRatio ? `${fmt(b.speedRatio * 100, 0)} %` : '–'];
    el.innerHTML = `<div class="card fields"><h3>All warnings on this page (${d.flags.length})</h3>${d.flags.length ? `<ul class="flags">${d.flags.map((f) => `<li class="${esc(f.level)}">${esc(f.text)}</li>`).join('')}</ul>` : '<p class="lock-note">No warnings.</p>'}
      <p class="notice"><b>Estimated.</b> Values marked from catalogue or data sheet are not held here, so a blank box gives a warning rather than a guess. A qualified engineer must confirm every value.</p></div>
    <div class="card fields"><h3>1. Inlet box, damper and silencer</h3><div class="two">
        ${faSelect('dBox', 'Inlet box', [['no', 'Not included'], ['yes', 'Included']])}${faSelect('dDamper', 'Damper', [['none', 'No damper'], ['inlet', 'Inlet louvre damper'], ['outlet', 'Outlet louvre damper'], ['viv', 'Inlet vane control']])}
        ${faSelect('dSil', 'Silencer', [['none', 'No silencer'], ['inlet', 'Inlet side'], ['outlet', 'Outlet side']])}${faSelect('dSilFill', 'Silencer fill', faPairs(F.SILENCER_FILL))}
        ${faSelect('dSilMoc', 'Silencer casing MOC', faPairs(F.SILENCER_MOC))}${faInput('dSilLen', 'Silencer length (m)', acc.silencer ? fmt(acc.silencer.L, 2) : '')}
        ${faInput('dSilFace', 'Face velocity (m/s)', '12')}${faInput('dSilOpen', 'Open area ratio', '0.45')}${faInput('dSilGap', 'Gap between splitters (m)', '0.15')}${faInput('dSilDb', 'Maker insertion loss (dB)', 'from data sheet')}
        ${faInput('dBoxK', 'Inlet box K (your value)', 'Assumed 0.8')}${faInput('dDamperK', 'Damper K, fully open', 'maker curve')}
      </div>
      ${acc.rows.length ? faTable(['Item', 'Velocity (m/s)', 'K', 'Loss (Pa)', 'Basis'], acc.rows.map((r) => [r.name, fmt(r.velocity, 1), fmt(r.k, 2), fmt(r.lossPa), r.basis])) : ''}
      <p class="lock-note">${esc(acc.note)}${acc.included ? ` Total ${fmt(acc.totalPa)} Pa adds about ${fmt(acc.extraKw, 1)} kW, so ${fmt(acc.newKw, 1)} kW and ${fmt(acc.newPa)} Pa in all.` : ''}${acc.silencer ? ` Silencer face about ${fmt(acc.silencer.side, 2)} m square, gap velocity ${fmt(acc.silencer.vGap, 1)} m/s.` : ''}</p></div>
    <div class="card fields"><h3>2. Start</h3><div class="two">
        ${faSelect('stGas', 'Gas temperature', faPairs(F.START_GAS))}${faSelect('stDust', 'Dust at start', faPairs(F.START_DUST))}${faSelect('stDamper', 'Damper at start', faPairs(F.START_DAMPER))}${faSelect('stMethod', 'Start method', faPairs(F.START_METHODS))}
      </div>
      ${faTable(['Method', 'Time (s)', 'Peak current (x FLC)', 'Result'], s.methods.map((m) => [F.START_METHODS[m.method], m.reached ? fmt(m.seconds, 0) : 'Cannot start', fmt(m.peakCurrent, 1), word[m.status]]))}
      <p class="lock-note">Motor data, and all 32 combinations, are on the Start conditions tab. ${esc(s.note)}</p></div>
    <div class="card fields"><h3>3. Shaft, diameter by diameter</h3><div class="two">
        ${faSelect('dMoc', 'Shaft MOC', [['', `Suggested: ${sh.material.label}`], ...faPairs(F.SHAFT_MOC)])}${faInput('dMargin', 'Critical speed margin (%)', '30')}
        ${faInput('dOver', 'Overhang (m)', fmt(sh.overhang, 3))}${faInput('dSpan', 'Bearing span (m)', fmt(sh.span, 3))}${faInput('dTail', 'Drive end length (m)', fmt(sh.tail, 3))}${faInput('dCoupKg', 'Coupling or pulley mass (kg)', '0')}
        ${faInput('dWheelD', 'Wheel seat dia (mm)', String(sh.auto.wheel))}${faInput('dNdeD', 'NDE seat dia (mm)', String(sh.auto.nde))}${faInput('dBodyD', 'Body dia (mm)', String(sh.auto.body))}${faInput('dDeD', 'DE seat dia (mm)', String(sh.auto.de))}${faInput('dCoupD', 'Coupling end dia (mm)', String(sh.auto.coupling))}
      </div>
      ${faTable(['Station', 'Dia (mm)', 'Needed (mm)', 'Moment (Nm)', 'Torque (Nm)', 'Bending (MPa)', 'Torsion (MPa)', 'Von Mises (MPa)', 'Fatigue safety', 'I (cm⁴)', 'J (cm⁴)'], sh.stations.map((t) => [t.name, fmt(t.dMm), fmt(t.needMm), fmt(t.momentNm), fmt(t.torqueNm), fmt(t.sigmaMPa, 1), fmt(t.tauMPa, 1), fmt(t.vonMisesMPa, 1), Number.isFinite(t.safetyFatigue) ? fmt(t.safetyFatigue, 1) : '–', fmt(t.I * 1e8, 0), fmt(t.J * 1e8, 0)]))}
      <p class="lock-note">First critical speed ${fmt(sh.criticalRpm)} rpm, ${fmt(sh.marginPct)} % above running speed. Wheel deflection ${fmt(sh.deflectionMm, 2)} mm. Slope at NDE ${fmt(sh.slopeNde * 1000, 2)} and DE ${fmt(sh.slopeDe * 1000, 2)} mrad. Shaft ${fmt(sh.shaftKg)} kg, inertia ${fmt(sh.shaftInertia, 2)} kg m². ${esc(sh.note)}</p></div>
    <div class="card fields"><h3>4. Rotor CG and bearing loads</h3>
      ${faTable(['Item', 'Value'], [['Arrangement', sh.arrangement === 'overhung' ? 'Overhung' : 'Between bearings'], ['Shaft length', `${fmt(sh.cg.shaftLengthM, 3)} m`], ['Wheel and hub mass, from the 3D model', `${fmt(sh.wheelKg)} kg`], ['Wheel CG from the backplate', `${fmt(sh.cg.wheelFromBackplateM * 1000)} mm`], ['Whole rotor mass', `${fmt(sh.cg.rotorKg)} kg`], ['Rotor CG from NDE bearing', `${fmt(sh.cg.fromNde * 1000)} mm`], ['Rotor CG from DE bearing', `${fmt(sh.cg.fromDe * 1000)} mm`], ['NDE radial load, with dynamic factor', `${fmt(sh.reactions.nde / 1000, 1)} kN`], ['DE radial load, with dynamic factor', `${fmt(sh.reactions.de / 1000, 1)} kN`]])}</div>
    <div class="card fields"><h3>5. Hub</h3><div class="two">
        ${faSelect('dHub', 'Hub type', [['', `Suggested: ${F.HUB_TYPES[hub.suggested]}`], ...faPairs(F.HUB_TYPES)])}${faInput('dHubOd', 'Hub OD (mm)', fmt(hub.od))}${faInput('dHubLen', 'Hub length (mm)', fmt(hub.len))}${faInput('dHubRating', 'Taper bush rating (Nm)', 'from maker')}${faInput('dHubInterf', 'Shrink interference (mm)', fmt(sh.dia.wheel * 0.001, 2))}
      </div>
      ${faTable(['Check', 'Value', 'Allowed', 'Used (%)'], hub.checks.map((c) => [c.name, `${fmt(c.value, 0)} ${c.unit}`, `${fmt(c.allow, 0)} ${c.unit}`, fmt(c.ratio * 100, 0)]))}
      <p class="lock-note">Key ${hub.key.b} x ${hub.key.h} mm, about ${fmt(hub.keyLen)} mm long. Hub about ${fmt(hub.massKg)} kg. ${esc(hub.note)}</p>
      ${faTable(['Hub types, best match first', 'Why'], hub.ranked.map((h) => [h.label, h.why[0] || 'No strong reason for or against.']))}</div>
    <div class="card fields"><h3>6. Bearings, DE and NDE</h3>
      <div class="two">${faSelect('dLocating', 'Locating bearing, takes the thrust', [['de', 'DE'], ['nde', 'NDE']])}${faInput('dTarget', 'Target L10h (h)', '40000')}${faInput('dThrust', 'Axial thrust (N)', fmt(br.faN))}${faInput('dHours', 'Running hours a year', '8000')}</div>
      ${bearingInputs('de', br.de)}${bearingInputs('nde', br.nde)}
      ${faTable(['Bearing', 'Selected', 'Fr (kN)', 'Fa (kN)', 'P (kN)', 'C needed (kN)', 'C entered (kN)', 'L10h', 'L10 years', 'Static safety', 'Speed used'], [bearingResult(br.de), bearingResult(br.nde)])}
      ${br.de.reliability || br.nde.reliability ? faTable(['Life at reliability', ...((br.de.reliability || br.nde.reliability).map((x) => `${x.pct} %`))], [br.de, br.nde].filter((b) => b.reliability).map((b) => [b.name, ...b.reliability.map((x) => `${fmt(x.hours, 0)} h`)])) : ''}
      <p class="lock-note">${br.systemL10h ? `System L10h for both bearings together: ${fmt(br.systemL10h)} h. ` : ''}${esc(br.thrustNote)} ${esc(br.basis)}</p>
      ${faTable(['Which type suits this speed and load', 'Suitable', 'Why'], br.advice.list.map((a) => [a.label, a.ok ? 'Yes' : 'Check', a.why]))}
      <p class="lock-note">n x dm about ${fmt(br.advice.ndm)} rpm mm. ${esc(br.advice.source)} The make does not change the calculation: the values you enter from that make's catalogue do.</p></div>
    <div class="card fields"><h3>7. Lubrication</h3><div class="two">
        ${faSelect('dLube', 'Lubricant', [['', `Suggested: ${lu.de.lube.label}`], ...faPairs(F.LUBES)])}${faInput('dBrgTemp', 'Bearing temperature (°C)', '70')}
      </div>
      ${faTable(['Bearing', 'Lubricant', 'Viscosity at temp (mm²/s)', 'Rated viscosity', 'Ratio κ', 'Relube every (h)', 'Grease each time (g)', 'Grease a year (g)'], [lu.de, lu.nde].map((l) => [l.name, l.lube.label, fmt(l.nu, 0), fmt(l.nu1, 0), fmt(l.kappa, 1), l.intervalH !== undefined ? fmt(l.intervalH, 0) : 'Oil', l.gramsEach !== undefined ? fmt(l.gramsEach, 0) : '–', l.gramsYear ? fmt(l.gramsYear, 0) : '–']))}
      <p class="lock-note">${esc(lu.basis)}</p></div>
    <div class="card fields"><h3>8. Maintenance schedule and cost</h3><div class="two">
        ${faInput('cLabour', 'Labour rate (₹/h)', 'your rate')}${faInput('cGrease', 'Grease (₹/kg)', 'your rate')}${faInput('cOil', 'Oil (₹/litre)', 'your rate')}${faInput('cBearing', 'Bearing, each (₹)', 'your price')}${faInput('cPower', 'Power (₹/kWh)', 'your rate')}
      </div>
      ${faTable(['Task', 'Every', 'Times a year', 'Cost each', 'Cost a year', 'Basis'], mt.rows.map((r) => [r.task, typeof r.every === 'number' ? `${fmt(r.every, 0)} ${r.unit}` : r.every, fmt(r.perYear, 1), money(r.costEach), money(r.costYear), r.tag]))}
      <p class="lock-note">Grease about ${fmt(mt.greaseKgYear, 1)} kg a year. ${mt.energyKwh ? `Accessory pressure loss uses about ${fmt(mt.energyKwh)} kWh a year${mt.energyYear ? `, ${money(mt.energyYear)}` : ''}. ` : ''}${mt.totalYear !== null && mt.totalYear !== undefined ? `Total of the costs entered: <b>${money(mt.totalYear)}</b> a year${mt.costComplete ? '' : ', with some rates still missing'}. ` : 'Enter your rates to see cost. '}${esc(mt.note)}</p></div>`;
  }
  function viewStart(el) {
    const FA = F;
    const s = bundle.start, x = s.selected;
    const word = { ok: 'OK', warn: 'Check', reject: 'Not suitable' };
    const opts = (o) => Object.entries(o);
    el.innerHTML = `<div class="card fields"><h3>Your start</h3><div class="two">
        ${faSelect('stGas', 'Gas temperature at start', opts(FA.START_GAS))}${faSelect('stDust', 'Dust at start', opts(FA.START_DUST))}
        ${faSelect('stDamper', 'Damper at start', opts(FA.START_DAMPER))}${faSelect('stMethod', 'Start method', opts(FA.START_METHODS))}
      </div>
      <p class="notice"><b>${pill(x.status, { ok: 'OK', warn: 'Check', reject: 'Not suitable' })} ${esc(x.label)}.</b> ${x.reached ? `Reaches speed in about <b>${fmt(x.seconds, 0)} s</b>, with a peak of <b>${fmt(x.peakCurrent, 1)} x full-load current</b> (about ${fmt(x.peakAmps, 0)} A).` : `<b>The motor cannot start the fan this way.</b> Torque runs out at ${fmt(x.stuckAt * 100, 0)} % speed.`}</p>
      ${faTable(['Item', 'Value'], [['Gas temperature', `${fmt(x.tempC, 0)} °C`], ['Density at start', `${fmt(x.rho, 3)} kg/m³`], ['Fan power during start', `${fmt(x.startKw, 1)} kW`], ['How that was set', x.loadBasis], ['Power at full flow with this gas, at the motor', `${fmt(x.runningKw, 1)} kW, against a ${x.motorKw} kW motor`], ...(x.changeoverAt !== null ? [['Star to delta changeover', `${fmt(x.changeoverAt * 100, 0)} % speed, about ${fmt(x.changeoverCurrent, 1)} x full-load current`]] : [])])}
      ${faFlags(x.flags)}<p class="lock-note">${esc(s.note)}</p></div>
    <div class="card fields"><h3>All four start methods, for this start</h3>
      ${faTable(['Method', 'Time (s)', 'Starting current (x FLC)', 'Peak current (x FLC)', 'Peak (A)', 'Result'], s.methods.map((m) => [FA.START_METHODS[m.method], m.reached ? fmt(m.seconds, 0) : 'Cannot start', fmt(m.startCurrent, 1), fmt(m.peakCurrent, 1), fmt(m.peakAmps, 0), word[m.status]]))}
      <p>${s.best ? `Lowest current that completes this start: <b>${esc(FA.START_METHODS[s.best.method])}</b>. Cost, supply limits and the need for speed control may still decide otherwise.` : '<b>No method completes this start.</b> Use a larger motor, or close the damper.'}</p></div>
    <div class="card fields"><h3>Motor and starter data</h3><p class="lock-note">Enter your motor data sheet values. Blank boxes use Assumed values.</p><div class="two">
      ${faInput('mLrt', 'Locked-rotor torque (x rated)', String(s.motor.lrt))}${faInput('mPut', 'Pull-up torque (x rated)', String(s.motor.put))}
      ${faInput('mBdt', 'Breakdown torque (x rated)', String(s.motor.bdt))}${faInput('mLrc', 'Locked-rotor current (x FLC)', String(s.motor.lrc))}
      ${faInput('mJ', 'Motor inertia (kg m²)', fmt(s.motor.inertia, 1))}${faInput('mV', 'Motor voltage (V)', String(s.motor.voltage))}
      ${faInput('mStallHot', 'Safe stall time, hot (s)', 'data sheet')}${faInput('mStallCold', 'Safe stall time, cold (s)', 'data sheet')}
      ${faInput('stDustLoad', 'Dust at start (g/m³)', String(Number(state.dustLoad) || 0))}${faInput('stClosedPct', 'Closed-damper power (% of open)', 'from your test curve')}
      ${faInput('stSoft', 'Soft starter current limit (x FLC)', '3.5')}${faInput('stRamp', 'VFD ramp time (s)', '60')}
      ${faInput('stVfdT', 'VFD torque limit (x rated)', '1.5')}
    </div></div>
    <details class="card"><summary>Every combination (32 starts)</summary><div class="fields">
      ${faTable(['Gas', 'Dust', 'Damper', 'Method', 'Power at start (kW)', 'Time (s)', 'Peak (x FLC)', 'Result'], s.matrix.map((m) => [FA.START_GAS[m.gas], FA.START_DUST[m.dust], FA.START_DAMPER[m.damper], FA.START_METHODS[m.method], fmt(m.startKw, 1), m.reached ? fmt(m.seconds, 0) : 'Cannot start', fmt(m.peakCurrent, 1), word[m.status]]))}
      <p class="lock-note">The worst running case is ${esc(s.worstRunning.label.split(', ').slice(0, 2).join(', ').toLowerCase())} at full flow: about ${fmt(s.worstRunning.runningKw, 0)} kW at the motor.</p></div></details>`;
  }
  const faSelect = (key, label, options) => `<div class="field"><label for="fa_${key}">${esc(label)}</label><select id="fa_${key}" data-fa="${key}">${options.map(([v, t]) => `<option value="${esc(v)}"${String(faOpts[key]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const faInput = (key, label, placeholder = '', hint = '') => `<div class="field"><label for="fa_${key}">${esc(label)}</label><input id="fa_${key}" class="text" data-fa="${key}" inputmode="decimal" value="${esc(faOpts[key])}" placeholder="${esc(placeholder)}">${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  const faFlags = (flags) => (flags.length ? `<div class="fields">${flags.map((f) => `<p class="notice"><b>${f.level === 'reject' ? 'Reject' : 'Warning'}:</b> ${esc(f.text)}</p>`).join('')}</div>` : '<p class="lock-note">No warnings from these checks.</p>');
  const faTable = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  function curveSvg(a) {
    const W = 860, H = 360, L = 66, R = 60, T = 16, B = 44;
    const pts = a.curve.points;
    const qMax = pts[pts.length - 1].q, pMax = Math.max(...pts.map((p) => p.pt)) * 1.15, kMax = Math.max(...pts.map((p) => p.power)) * 1.15 / 1000;
    const X = (q) => L + (q / qMax) * (W - L - R), Y = (v, m) => H - B - (Math.max(v, 0) / m) * (H - T - B);
    const line = (get, m, cls) => `<polyline fill="none" class="${cls}" points="${pts.map((p) => `${X(p.q).toFixed(1)},${Y(get(p), m).toFixed(1)}`).join(' ')}"/>`;
    const band = a.curve.bands ? (() => {
      const up = [], dn = [];
      pts.forEach((p, i) => { const b = a.curve.bands[i]; if (b?.ptPct) { up.push(`${X(p.q).toFixed(1)},${Y(p.pt * (1 + b.ptPct / 100), pMax).toFixed(1)}`); dn.unshift(`${X(p.q).toFixed(1)},${Y(p.pt * (1 - b.ptPct / 100), pMax).toFixed(1)}`); } });
      return `<polygon points="${[...up, ...dn].join(' ')}" fill="var(--accent-wash)"/>`;
    })() : '';
    const grid = [0, 1, 2, 3, 4, 5].map((i) => {
      const y = T + ((H - T - B) * i) / 5, x = L + ((W - L - R) * i) / 5;
      return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)"/><line y1="${T}" y2="${H - B}" x1="${x}" x2="${x}" stroke="var(--line)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor">${fmt((pMax * (5 - i)) / 5, 0)}</text><text x="${W - R + 6}" y="${y + 4}" font-size="11" fill="currentColor">${fmt((kMax * (5 - i)) / 5, kMax < 10 ? 1 : 0)}</text><text x="${x}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor">${fmt((qMax * i) / 5, qMax < 20 ? 1 : 0)}</text>`;
    }).join('');
    const stall = `<rect x="${L}" y="${T}" width="${Math.max(X(a.stall.stallQ) - L, 0)}" height="${H - T - B}" fill="var(--bad-ink)" opacity="0.08"/>`;
    const op = a.operating?.found ? `<circle cx="${X(a.operating.q)}" cy="${Y(a.operating[a.operating.pressureUsed], pMax)}" r="5" fill="var(--accent)"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fan curve from shut-off to free delivery" style="width:100%;height:auto;color:var(--ink)"><style>.c-pt{stroke:var(--accent);stroke-width:3}.c-ps{stroke:var(--accent);stroke-width:1.5;stroke-dasharray:6 4}.c-kw{stroke:#d9772b;stroke-width:2}.c-eta{stroke:#3f9e4d;stroke-width:2}</style>${stall}${band}${grid}${line((p) => p.pt, pMax, 'c-pt')}${line((p) => p.ps, pMax, 'c-ps')}${line((p) => p.power / 1000, kMax, 'c-kw')}${line((p) => p.etaT * pMax, pMax, 'c-eta')}<line x1="${X(a.curve.qDesign)}" x2="${X(a.curve.qDesign)}" y1="${T}" y2="${H - B}" stroke="currentColor" stroke-dasharray="3 3"/>${op}<text x="${(W - R + L) / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="currentColor">Flow (m³/s)</text></svg>
      <p class="lock-note"><b style="color:var(--accent)">Solid blue:</b> total pressure (Pa, left). <b style="color:var(--accent)">Dashed blue:</b> static pressure. <b style="color:#d9772b">Orange:</b> shaft power (kW, right). <b style="color:#3f9e4d">Green:</b> total efficiency (top of the chart is 115 %). Shaded red: estimated unstable zone. Dotted line: design flow. Dot: operating point.</p>`;
  }

  function viewCurve(el) {
    const a = bundle.analysis, p = a.point;
    const cat = a.categoryWarning;
    const total = Object.values(p.losses).reduce((s, x) => s + x, 0);
    el.innerHTML = `<div class="card fields"><h3>Performance curve</h3>
      <p class="notice"><b>Estimated.</b> ${esc(a.curve.label)} ${esc(a.statement)}</p>
      ${curveSvg(a)}
      ${faTable(['Point', 'Flow (m³/s)', 'Total pressure (Pa)', 'Static pressure (Pa)', 'Shaft power (kW)', 'Total eff. (%)', 'Static eff. (%)'], a.table.map((x) => [x.name, fmt(x.q, 2), fmt(x.pt, 0), fmt(x.ps, 0), fmt(x.power / 1000, 1), fmt(x.etaT * 100, 0), fmt(x.etaS * 100, 0)]))}
      <p class="lock-note">Against the engine at design flow: pressure ${fmt((p.pt / result.dp - 1) * 100, 0)} % and power ${fmt((p.power / 1000 / result.row.kw - 1) * 100, 0)} %. This compares two estimates; it is not an error measured against a test.</p>
      ${faFlags([...a.stall.flags, ...(a.overload?.flags ?? []), ...(cat ? [cat] : []), ...a.scope.flags])}</div>
    <div class="card fields"><h3>Method options</h3><div class="two">
      ${faSelect('slip', 'Slip model', [['legacy', 'Existing engine method (default)'], ['wiesner', 'Wiesner as written'], ['stodola', 'Stodola'], ['pfleiderer', 'Pfleiderer (UNVERIFIED coefficient)']])}
      ${faSelect('casingType', 'Casing', [['volute', 'Volute'], ['plug', 'Plug fan, no casing']])}
      ${faSelect('category', 'Installation category', [['A', 'A: free inlet, free outlet'], ['B', 'B: free inlet, ducted outlet'], ['C', 'C: ducted inlet, free outlet'], ['D', 'D: ducted inlet, ducted outlet']])}
      ${faInput('gapRatio', 'Inlet gap (% of inlet diameter)', '1')}
      ${faInput('diffuserAreaRatio', 'Outlet diffuser area ratio', 'none')}
      ${faInput('fixedPa', 'System fixed pressure (Pa)', '0')}
      ${faInput('sefCoefficient', 'System effect factor', '0', 'Multiple of outlet velocity pressure, from your AMCA 201 copy.')}
    </div><p class="lock-note">Slip models disagree by about ${fmt(p.spreadPct, 0)} % on whirl velocity here, which is one measure of the uncertainty. Active: ${esc(a.methodText[faOpts.slip] || '')}</p></div>
    <div class="card fields"><h3>Where the energy goes at design flow</h3>
      ${faTable(['Term', 'J/kg', 'Share of Euler work (%)', 'Calibration multiplier'], Object.entries(p.losses).map(([k, v]) => [k, fmt(v, 0), fmt((v / (p.eulerPa / result.rho)) * 100, 1), fmt(a.multipliers[k], 2)]))}
      <p class="lock-note">Hydraulic losses total ${fmt(total, 0)} J/kg of ${fmt(p.eulerPa / result.rho, 0)} J/kg Euler work. Disc friction ${fmt(p.discW / 1000, 2)} kW (regime ${esc(p.discRegime)}), bearing ${fmt(p.bearingW / 1000, 2)} kW, inlet leakage ${fmt((p.qLeak / result.qTotal) * 100, 1)} % of flow. Blockage from blade thickness: inlet ${fmt(p.blockage.inlet, 3)}, outlet ${fmt(p.blockage.outlet, 3)}.</p></div>
    <div class="card fields"><h3>Operating point and VFD</h3>
      <p>${a.operating.found ? `With the system curve through the duty, the fan runs at <b>${fmt(a.operating.q, 2)} m³/s</b> and <b>${fmt(a.operating[a.operating.pressureUsed], 0)} Pa</b> (${a.operating.pressureUsed === 'pt' ? 'total' : 'static'} pressure), taking ${fmt(a.operating.power / 1000, 1)} kW.` : esc(a.operating.text)}</p>
      ${faTable(['Speed', 'rpm', 'Flow (m³/s)', 'Total pressure (Pa)', 'Power (kW)', 'Eff. after Reynolds (%)', 'Flags'], a.vfd.rows.map((r) => [`${r.speedRatio * 100} %`, fmt(r.rpm, 0), fmt(r.q, 2), fmt(r.pt, 0), fmt(r.power / 1000, 1), fmt(r.etaRe * 100, 0), r.flags.join('; ') || '–']))}</div>
    <div class="card fields"><h3>What moves the answer most (±20 % change)</h3>
      ${faTable(['Item', 'Pressure (%)', 'Power (%)', 'Efficiency (points)'], a.sensitivity.slice(0, 8).map((s) => [s.name, fmt(s.ptPct, 1), fmt(s.powerPct, 1), fmt(s.etaPts, 1)]))}</div>`;
  }

  function viewStandards(el) {
    const a = bundle.analysis, air = bundle.standards.air, volute = bundle.standards.volute;
    const g = result.geo;
    const blade = F.BLADES[result.bladeId];
    el.innerHTML = `<div class="card fields"><h3>Air density</h3><div class="two">${faInput('rhPct', 'Relative humidity (%)', '0')}${faInput('baroPa', 'Barometric pressure (Pa)', 'from altitude')}</div>
      ${faTable(['Item', 'Value'], [['Density with humidity', `${fmt(air.rho, 3)} kg/m³`], ['Dry air density', `${fmt(air.rhoDry, 3)} kg/m³`], ['Engine working density, used for design', `${fmt(result.rho, 3)} kg/m³`], ['Pressure scaled to humid density', `${fmt((result.dp * air.rho) / result.rho, 0)} Pa`]])}
      <p class="lock-note">The design above still uses the engine density. These are extra fields, and they change nothing.</p>${faFlags(air.flags)}</div>
    <div class="card fields"><h3>Specific speed</h3>
      ${faTable(['Measure', 'Value', 'Convention'], [['Cordier σ', fmt(a.sim.sigma, 3), 'φ^0.5/ψ^0.75 = 2.108 n√Q/Y^0.75'], ['Cordier δ', fmt(a.sim.delta, 2), 'ψ^0.25/φ^0.5 = 1.054 D Y^0.25/√Q'], ['Balje Ns', fmt(a.sim.Ns, 2), 'ω√Q/Y^0.75'], ['Balje Ds', fmt(a.sim.Ds, 2), 'D Y^0.25/√Q'], ['nq', fmt(a.sim.nq, 0), 'n[rpm]√Q/H[m]^0.75'], ['Nominal σ of this wheel type', fmt(a.cordier.nominalSigma, 3), 'From the engine type values']])}
      <p class="lock-note">${a.cordier.cordierLoaded ? 'Compared with your Cordier line.' : 'No Cordier or Balje line is held, so position is checked against this wheel type only. Supply a digitised line to compare with one.'}</p>${faFlags(a.cordier.flags)}</div>
    <div class="card fields"><h3>Wheel proportions</h3>
      ${faTable(['Item', 'This design', 'Range for this type (engine, Assumed)'], [['Blade count', String(g.z), `${blade.z[0]} to ${blade.z[1]}`], ['Width ratio b2/D2', fmt(g.b2 / g.D2, 3), `${blade.bD[0]} to ${blade.bD[1]}`], ['Blade outlet angle', `${fmt(g.beta2, 0)}°`, 'Fixed by type'], ['Diameter ratio D1/D2', fmt(g.D1 / g.D2, 3), bladeRatioNote()], ['Wiesner valid to D1/D2', fmt(p2Limit(a), 3), a.point.wiesnerInRange ? 'Within range' : 'Outside range: slip is less reliable']])}
      ${g.z < blade.z[0] || g.z > blade.z[1] ? '<p class="notice"><b>Warning:</b> blade count is outside the usual range for this type.</p>' : ''}</div>
    <div class="card fields"><h3>Volute</h3>${faSelect('volute', 'Method', [['constantMomentum', 'Constant angular momentum'], ['constantVelocity', 'Constant velocity']])}
      ${faTable(['Angle from cut-off', 'Area (m²)', 'Radius (m)', 'Mean velocity (m/s)'], volute.rows.filter((_, i) => i % 3 === 0).map((r) => [`${r.thetaDeg}°`, fmt(r.areaM2, 3), fmt(r.radiusM, 3), r.meanV ? fmt(r.meanV, 1) : '–']))}
      <p class="lock-note">Cut-off clearance from the engine: ${fmt(result.casing.cutoffClearance * 1000, 0)} mm. Other values are shown for comparison and do not replace the engine scroll.</p></div>
    <div class="card fields"><h3>Mechanical checks</h3>
      ${faTable(['Check', 'Result', 'Limit or target', 'Basis'], [
        ['Tip speed, plain-disc screening', `${fmt(a.tip.tipSpeed, 0)} m/s`, `${fmt(a.tip.uMax, 0)} m/s`, 'Timoshenko disc, at overspeed'],
        ['Blade weld shear', `${fmt(a.joint.tauMPa, 0)} MPa`, `${fmt(a.joint.allowMPa, 0)} MPa`, 'Screening, Assumed weld size and limit'],
        ['First critical speed', `${fmt(result.shaft.criticalRpm, 0)} rpm`, `${fmt(result.shaft.marginPct, 0)} % above running speed`, 'Existing engine'],
        ['Balance grade', a.balance.grade, `${fmt(a.balance.uPerGmm, 0)} g mm allowed, ${fmt(a.balance.perPlaneGmm, 0)} per plane`, 'ISO 1940-1. Confirm the grade with ISO 14694'],
        ...a.bearing.rows.map((b) => [`Bearing ${b.name}`, b.l10h ? `L10 ${fmt(b.l10h, 0)} h` : `Needs C ≥ ${fmt(b.requiredCkN, 1)} kN`, `${fmt(a.bearing.targetHours, 0)} h target`, `ISO 281, load ${fmt(b.loadN / 1000, 1)} kN`]),
        ['Motor', `${a.motor.kw ?? '–'} kW, ${esc(a.motor.voltage)}`, `${a.motor.serviceMarginPct === null ? '–' : fmt(a.motor.serviceMarginPct, 0)} % above required`, a.motor.frame4Pole ? `4-pole frame ${a.motor.frame4Pole}, UNVERIFIED` : 'Frame from your maker'],
      ])}
      <div class="two">${faSelect('bearingType', 'Bearing type', [['roller', 'Roller'], ['ball', 'Ball']])}${faInput('cA', 'Catalogue C, bearing A (kN)', 'from your catalogue')}${faInput('cB', 'Catalogue C, bearing B (kN)', 'from your catalogue')}</div>
      <p class="lock-note">${esc(a.bearing.note)} ${esc(a.joint.note)}</p>
      <p class="lock-note">ISO 12759 efficiency grade: not calculated. The coefficients held are UNVERIFIED, so they stay out until checked against your copy.</p>${faFlags([...a.tip.flags, ...a.joint.flags])}</div>`;
  }
  const bladeRatioNote = () => (result.bladeId === 'forward' ? 'Up to 0.9' : '0.32 to 0.82');
  const p2Limit = (a) => a.point.limitRatio;

  function viewOutputs(el) {
    const o = bundle.outputs, a = bundle.analysis;
    const checks = o.checks, rt = o.trip, c = o.vs, flat = { bladeDevelopedLength: o.bladeDevelopedLength }, die = o.die, model = { hollowNote: o.hollowNote };
    el.innerHTML = `<div class="card fields"><h3>3D model and flat patterns</h3>
      ${faSelect('profile', 'Blade profile', [['', 'Automatic for this wheel type'], ['single-arc', 'Single arc'], ['double-arc', 'Double arc'], ['airfoil', 'Airfoil']])}
      <div class="row"><button class="btn btn-primary" id="saveStl" type="button">Save STL</button><button class="btn" id="saveStep" type="button">Save STEP</button><button class="btn" id="saveFlat" type="button">Save flat patterns (DXF)</button><button class="btn" id="saveFea" type="button">Save FEA hand-off</button></div>
      <p class="lock-note">STEP holds faceted solids, which read into CAD as solids made of flat triangles. Rebuild smooth surfaces there before manufacture. Parts touch but are not merged. Not for manufacture.</p>
      ${pill(checks.ok ? 'ok' : 'warn', { ok: 'Geometry checks passed', warn: 'Geometry check problem' })}
      ${faTable(['Check', 'Result'], [['Every solid watertight', checks.watertight ? 'Yes' : `No: ${checks.notClosed.slice(0, 3).join(', ')}`], ['Blade count', `${checks.blades} of ${checks.expected}`], ['Neighbouring blades clear at the inlet', checks.noBladeClash ? 'Yes' : 'No'], ['Blade developed length', `${fmt(flat.bladeDevelopedLength, 0)} mm`]])}</div>
    <div class="card fields"><h3>Round-trip check: measured from the 3D model</h3>
      ${faTable(['Quantity', 'Design', 'Measured', 'Result'], rt.rows.map((r) => [r.name, fmt(r.design, 3), fmt(r.measured, 3), r.pass ? 'Pass' : 'FAIL']))}</div>
    <div class="card fields"><h3>Mass and inertia from the 3D model</h3>
      ${faTable(['Quantity', '3D model', 'Engine estimate', 'Difference (%)'], [['Wheel mass (kg)', fmt(c.cadKg, 0), fmt(c.engineKg, 0), fmt(c.massDiffPct, 0)], ['Polar inertia (kg m²)', fmt(c.cadInertia, 1), fmt(c.engineInertia, 1), fmt(c.inertiaDiffPct, 0)], ['Starting time (s)', c.startSecondsCad ? fmt(c.startSecondsCad, 1) : '–', c.startSecondsEngine ? fmt(c.startSecondsEngine, 1) : '–', '']])}
      <p class="lock-note">Stress, shaft and starting results elsewhere still use the engine estimate. Use this difference to judge how far to trust them. ${esc(model.hollowNote)}</p></div>
    <div class="card fields"><h3>Reports</h3>
      <div class="row"><button class="btn btn-primary" id="saveXlsx" type="button">Save Excel calculation</button><button class="btn" id="saveDocx" type="button">Save Word report</button></div>
      <p class="notice">${esc(a.statement)}</p></div>
    <div class="card fields"${o.isAdmin ? '' : ' hidden'}><h3>Calibration coefficients</h3>
      <p>${faCoefficients ? `Loaded set <b>${esc(faCoefficients.version)}</b>, dataset ${esc(faCoefficients.datasetHash.slice(0, 12))}. Curves now use these multipliers.` : 'None loaded. Curves use the published coefficients with every multiplier at 1.'}</p>
      <div class="row"><button class="btn" id="loadCoef" type="button">Load coefficient set</button>${faCoefficients ? '<button class="btn" id="clearCoef" type="button">Remove</button>' : ''}<input id="coefFile" type="file" accept=".json,application/json" hidden></div></div>
    <div class="card fields"><h3>Die-cast rules</h3>
      ${faTable(['Rule', 'Value'], [['Minimum blade thickness', `${die.rules.minThickness} mm`], ['Draft angle', `${die.rules.draftDeg}°`], ['Hub fillet', `${die.rules.filletMm} mm`]])}
      <p class="lock-note">${esc(die.note)}</p></div>`;
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
  function viewCad(el) {
    el.innerHTML = `<div class="card fields"><div class="row space-between"><p class="panel-lead">General arrangement drawn to scale from this calculation: front view with the blades and scroll, and a section through the shaft.</p>
        <div class="row"><button class="btn btn-primary" id="saveDxf" type="button">Save DXF for CAD</button><button class="btn" id="saveSvg" type="button">Save SVG</button></div></div>
        <div class="drawing">${bundle.cadSvg}</div>
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
    shell('Fan Pro is being set up', '<p>Please contact the admin for access.</p>');
  } else if (FanAuth.hasSession()) afterLogin();
  else entry();
})();
