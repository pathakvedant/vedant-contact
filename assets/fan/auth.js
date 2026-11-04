/* Fan software accounts: a small client for Supabase Auth and the database functions.
   The server decides who has access. Nothing in this file can grant access by itself. */
const FanAuth = (() => {
  const cfg = window.FAN_CONFIG || {};
  const KEY = 'traass_fan_session';
  const ready = () => Boolean(cfg.supabaseUrl && cfg.anonKey);
  const base = () => cfg.supabaseUrl.replace(/\/+$/, '');

  // Throwaway mail services are refused here and again by the database.
  const DISPOSABLE = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com'];
  function checkEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (e.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e)) return 'Enter a valid email address.';
    if (DISPOSABLE.includes(e.split('@')[1])) return 'Please use your work or regular email, not a temporary one.';
    return '';
  }
  function checkPassword(pw) {
    if (String(pw).length < 10) return 'Use at least 10 characters.';
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers.';
    return '';
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = (s) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* session lasts this page only */ } };
  let session = load();

  async function call(path, { method = 'POST', body, token } = {}) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 20000);
    try {
      const r = await fetch(base() + path, {
        method,
        signal: c.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json', Authorization: `Bearer ${token || cfg.anonKey}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!r.ok) {
        const err = new Error(friendly(data, r.status));
        err.status = r.status;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('Could not reach the server. Please check your connection.');
      throw e;
    } finally { clearTimeout(t); }
  }
  function friendly(d, status) {
    const m = String((d && (d.msg || d.message || d.error_description || d.error)) || '');
    if (/invalid login/i.test(m)) return 'Wrong email or password.';
    if (/not confirmed/i.test(m)) return 'Please confirm your email first.';
    if (/already registered|already exists/i.test(m)) return 'This email already has an account. Please log in.';
    if (/expired|invalid.*(otp|token)|otp.*invalid/i.test(m)) return 'That code is wrong or has expired. Request a new one.';
    if (/disposable/i.test(m)) return 'Please use your work or regular email, not a temporary one.';
    if (status === 429 || /rate limit|security purposes/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
    return 'Something went wrong. Please try again.';
  }
  function take(data) {
    if (data && data.access_token) {
      session = { access: data.access_token, refresh: data.refresh_token, expires: Date.now() + (data.expires_in || 3600) * 1000, email: data.user && data.user.email };
      save(session);
    }
    return session;
  }
  async function token() {
    if (!session) return null;
    if (Date.now() > session.expires - 60000) {
      try { take(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh } })); } catch (e) {
        if (e.status) { session = null; save(null); }
        throw e;
      }
    }
    return session && session.access;
  }

  return {
    ready, checkEmail, checkPassword,
    email: () => session && session.email,
    hasSession: () => Boolean(session),
    signUp: (email, password) => call('/auth/v1/signup', { body: { email: email.trim().toLowerCase(), password } }),
    resend: (email) => call('/auth/v1/resend', { body: { type: 'signup', email: email.trim().toLowerCase() } }),
    verify: async (email, code, type = 'signup') => take(await call('/auth/v1/verify', { body: { type, email: email.trim().toLowerCase(), token: code.trim() } })),
    logIn: async (email, password) => take(await call('/auth/v1/token?grant_type=password', { body: { email: email.trim().toLowerCase(), password } })),
    recover: (email) => call('/auth/v1/recover', { body: { email: email.trim().toLowerCase() } }),
    setPassword: async (password) => call('/auth/v1/user', { method: 'PUT', body: { password }, token: await token() }),
    logOut: async () => { const t = session && session.access; session = null; save(null); if (t) await call('/auth/v1/logout', { token: t }).catch(() => {}); },
    rpc: async (name, args = {}) => call(`/rest/v1/rpc/${name}`, { body: args, token: await token() }),
  };
})();
