/* MiniFan Pro interface. All calculations live in core.js. */
(function () {
  'use strict';

  const Core = FanCore;
  const STORAGE_KEY = 'minifan-pro-project';
  const TABS = ['selection', 'curves', 'mechanical', 'noise', 'quote', 'drawing', 'fans', 'method'];
  const $ = (sel) => document.querySelector(sel);

  let state = loadDraft() || markExamples(FanDefaults());
  let result = null;
  let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'selection';
  let editingDesign = state.designs[0] ? state.designs[0].name : null;
  let confirmReset = false;
  let confirmDelete = false;
  let showRejected = false;
  let frame = 0;

  /* ---------- Helpers ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(value, digits = 0) {
    if (!Number.isFinite(value)) return '–';
    return value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function rupees(value) {
    return `₹${fmt(value, 0)}`;
  }
  function flowUnit() {
    return Core.FLOW_UNITS[state.duty.flowUnit] || Core.FLOW_UNITS.m3s;
  }
  function pressureUnit() {
    return Core.PRESSURE_UNITS[state.duty.pressureUnit] || Core.PRESSURE_UNITS.pa;
  }
  function flowDigits(value) {
    return value >= 1000 ? 0 : value >= 100 ? 1 : 2;
  }
  function showFlow(si) {
    const v = si / flowUnit().toSI;
    return fmt(v, flowDigits(v));
  }
  function showPressure(si) {
    const v = si / pressureUnit().toSI;
    return fmt(v, v >= 100 ? 0 : 1);
  }
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 4200);
  }
  function setPath(path, value) {
    const parts = path.split('.');
    let node = state;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
    node[parts[parts.length - 1]] = value;
  }
  function getPath(path) {
    return path.split('.').reduce((node, key) => (node ? node[key] : undefined), state);
  }
  function markExamples(project) {
    project.designs.forEach((d) => { d.example = true; });
    return project;
  }
  function statusPill(status, labels = {}) {
    const text = { ok: labels.ok || 'Meets limits', warn: labels.warn || 'Check', reject: labels.reject || 'Fails a limit' }[status];
    const icon = { ok: '✓', warn: '!', reject: '✕' }[status];
    return `<span class="pill ${status}"><i aria-hidden="true">${icon}</i>${text}</span>`;
  }
  function inViewer() {
    if (window.claude && window.claude.use) return true;
    try { return window.top !== window; } catch { return true; }
  }

  /* ---------- Project storage ---------- */

  function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.designs)) return null;
    const base = FanDefaults();
    ['project', 'duty', 'limits', 'drive', 'mech', 'noise', 'rates'].forEach((section) => {
      if (raw[section] && typeof raw[section] === 'object') {
        Object.keys(base[section]).forEach((key) => {
          if (raw[section][key] !== undefined && raw[section][key] !== null) base[section][key] = String(raw[section][key]);
        });
      }
    });
    base.whatIf = Number(raw.whatIf) || 100;
    base.selected = raw.selected && typeof raw.selected.design === 'string' && Number.isFinite(raw.selected.d)
      ? { design: raw.selected.design, d: raw.selected.d } : null;
    base.designs = raw.designs.filter((d) => d && typeof d === 'object').map((d) => ({
      name: String(d.name || 'Design'),
      type: Core.FAN_TYPES[d.type] ? d.type : 'backward',
      basis: String(d.basis || 'Total pressure'),
      refD: Number(d.refD),
      refRpm: Number(d.refRpm),
      refRho: Number(d.refRho),
      example: Boolean(d.example),
      points: Array.isArray(d.points) ? d.points.map((p) => ({ q: Number(p.q), p: Number(p.p), eta: Number(p.eta) })) : [],
    }));
    return base;
  }
  function loadDraft() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      return text ? normalizeProject(JSON.parse(text)) : null;
    } catch {
      return null;
    }
  }
  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* the page works without storage */ }
  }
  async function saveFile(filename, data, mime) {
    if (inViewer()) {
      let downloads = null;
      try { downloads = window.claude ? await window.claude.use('downloads') : null; } catch { downloads = null; }
      if (!downloads) { toast('Saving files is not available in this view.'); return; }
      try {
        await downloads.save({ filename, data });
        toast(`Saved ${filename}`);
      } catch (err) {
        if (err && err.code === 'declined') return;
        if (err && err.code === 'rate_limited') { toast('A save is already waiting for your answer.'); return; }
        toast('The file could not be saved in this view.');
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Saved ${filename}`);
  }
  function fileStem() {
    return String(state.project.reference || 'minifan').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'minifan';
  }

  /* ---------- Main update ---------- */

  function schedule() {
    clearTimeout(frame);
    frame = setTimeout(update, 30);
  }
  function update() {
    result = Core.analyse(state);
    renderDensity();
    renderSummary();
    renderActivePanel();
    saveDraft();
  }
  function syncInputs() {
    document.querySelectorAll('[data-path]').forEach((el) => {
      const value = getPath(el.dataset.path);
      el.value = value === undefined || value === null ? '' : value;
    });
    $('#whatIf').value = state.whatIf;
  }
  function renderDensity() {
    const el = $('#densityNote');
    if (result.errors.length) { el.textContent = ''; return; }
    el.innerHTML = `Working density <b>${fmt(result.rho, 3)} kg/m³</b>, cold start <b>${fmt(result.rhoCold, 3)} kg/m³</b>`;
  }

  /* ---------- Summary ---------- */

  function impellerSvg(type, rpm) {
    const sweep = type === 'forward' ? -35 : type === 'radial' ? 0 : 35;
    const blades = [];
    const root = type === 'forward' ? 0.72 : 0.6;
    const count = 10;
    for (let b = 0; b < count; b++) {
      const start = (b / count) * 2 * Math.PI;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const a = start - ((sweep * Math.PI) / 180) * t ** 1.5;
        const r = 44 * (root + (1 - root) * t);
        pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
      }
      blades.push(`<polyline points="${pts.join(' ')}"/>`);
    }
    const seconds = Math.max(0.8, Math.min(8, 2400 / Math.max(rpm, 1))).toFixed(2);
    return `<svg class="impeller" viewBox="-50 -50 100 100" aria-hidden="true">
      <g class="spin" style="animation-duration:${seconds}s" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <circle r="44"/><circle r="${(44 * root).toFixed(1)}"/>${blades.join('')}
      </g><circle r="6" fill="currentColor"/></svg>`;
  }
  function renderSummary() {
    const el = $('#summary');
    if (result.errors.length) {
      el.innerHTML = `<h2>Check your inputs</h2><ul class="problems">${result.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
      return;
    }
    if (!result.selected) {
      el.innerHTML = `<h2>No fan meets this duty</h2>
        <p class="panel-lead">None of your designs and sizes can reach this flow and pressure within the limits. Try more sizes, higher limits or another fan design.</p>`;
      return;
    }
    const s = result.selected;
    const m = result.motor;
    const typeLabel = Core.FAN_TYPES[result.design.type].label;
    const unit = flowUnit().label;
    const flags = result.flags.length
      ? `<ul class="flags">${result.flags.map((f) => `<li class="${f.level}">${esc(f.text)}</li>`).join('')}</ul>` : '';
    const example = result.design.example
      ? `<p class="notice"><b>This fan's data is invented for teaching.</b> Enter your own tested data under Fan data before you rely on any result.</p>` : '';
    el.innerHTML = `
      <div class="summary-head">
        ${impellerSvg(result.design.type, s.rpm)}
        <div class="summary-title">
          <h2>${esc(s.design)}, ${fmt(s.d * 1000, 0)} mm</h2>
          <p>${typeLabel} ${result.autoSelected ? 'chosen as the most efficient fit' : 'chosen by you'} for ${showFlow(result.q)} ${unit} at ${showPressure(result.p)} ${pressureUnit().label}</p>
        </div>
        ${statusPill(result.overall)}
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Speed</div><div class="v">${fmt(s.rpm)}<small>rpm</small></div></div>
        <div class="stat"><div class="k">Efficiency</div><div class="v">${fmt(s.eta * 100, 1)}<small>%</small></div></div>
        <div class="stat"><div class="k">Shaft power</div><div class="v">${fmt(s.kw, 1)}<small>kW</small></div></div>
        <div class="stat"><div class="k">Motor</div><div class="v">${m.motorKw === null ? '–' : fmt(m.motorKw, m.motorKw < 10 ? 1 : 0)}<small>kW</small></div></div>
        <div class="stat"><div class="k">Tip speed</div><div class="v">${fmt(s.tip, 1)}<small>m/s</small></div></div>
        <div class="stat"><div class="k">Sound, ${fmt(result.noise.distance, 1)} m</div><div class="v">${fmt(result.noise.lpA, 0)}<small>dB(A)</small></div></div>
      </div>
      ${flags}${example}`;
  }

  /* ---------- Tabs ---------- */

  function setTab(name, focus) {
    activeTab = name;
    TABS.forEach((tab) => {
      const button = $(`#tab-${tab}`);
      const selected = tab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(`#panel-${tab}`).hidden = !selected;
      if (selected && focus) button.focus();
    });
    renderActivePanel();
  }
  function renderActivePanel() {
    const render = { selection: renderSelection, curves: renderCurves, mechanical: renderMechanical, noise: renderNoise, quote: renderQuote, drawing: renderDrawing, fans: renderFans, method() {} };
    render[activeTab]();
  }
  function emptyPanel() {
    if (result.errors.length) return 'Fix the inputs shown above to see this view.';
    if (!result.selected) return 'No fan meets this duty yet, so there is nothing to show here.';
    return '';
  }
  function guard(el) {
    const message = emptyPanel();
    if (message) { el.innerHTML = `<p class="panel-lead">${message}</p>`; return true; }
    return false;
  }

  /* ---------- Selection ---------- */

  function renderSelection() {
    const el = $('#panel-selection');
    if (result.errors.length) { guard(el); return; }
    const usable = result.rows.filter((r) => r.status !== 'reject').length;
    if (!result.rows.length) {
      el.innerHTML = `<div class="card"><p class="panel-lead">No size in your list can reach this duty. Add sizes or another fan design.</p></div>`;
      return;
    }
    const speeds = Core.parseNumberList(state.limits.motorSpeeds);
    const rejected = result.rows.length - usable;
    const isPicked = (r) => result.selected && r.design === result.selected.design && r.d === result.selected.d;
    const shown = result.rows.filter((r) => showRejected || r.status !== 'reject' || isPicked(r));
    const rows = shown.map((r) => {
      const picked = isPicked(r);
      const direct = speeds.find((s) => Math.abs(r.rpm - s) / s <= 0.02);
      const id = `pick-${esc(r.design)}-${r.d}`.replace(/[^\w-]/g, '_');
      return `<tr class="pickable${picked ? ' picked' : ''}${r.status === 'reject' ? ' muted-row' : ''}" data-design="${esc(r.design)}" data-d="${r.d}">
        <td><input type="radio" name="pickFan" id="${id}" aria-label="Choose ${esc(r.design)} ${fmt(r.d, 2)} m" ${picked ? 'checked' : ''}></td>
        <td>${esc(r.design)}</td>
        <td class="n">${fmt(r.d, 2)}</td>
        <td class="n">${fmt(r.rpm)}</td>
        <td class="n">${fmt(r.eta * 100, 1)}</td>
        <td class="n">${fmt(r.kw, 1)}</td>
        <td class="n">${fmt(r.tip, 1)}</td>
        <td>${direct ? `Direct at ${fmt(direct)}` : 'Belt or VFD'}</td>
        <td>${statusPill(r.status, { ok: 'Fits', warn: 'Check', reject: 'Rejected' })}${r.flags.length ? `<span class="why">${esc(r.flags[0].text)}</span>` : ''}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div class="card fields">
      <div class="row space-between">
        <p class="panel-lead"><b>${usable} of ${result.rows.length}</b> possible fans fit your limits, best efficiency first. Choose any row to see its details.</p>
        ${result.autoSelected ? '' : '<button class="btn" id="autoPick" type="button">Back to best choice</button>'}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th aria-label="Choose"></th><th>Design</th><th class="n">Size (m)</th><th class="n">Speed (rpm)</th><th class="n">Eff. (%)</th><th class="n">Shaft (kW)</th><th class="n">Tip (m/s)</th><th>Drive</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${rejected ? `<div class="row"><button class="btn" id="toggleRejected" type="button">${showRejected ? 'Hide' : 'Show'} ${rejected} rejected ${rejected === 1 ? 'size' : 'sizes'}</button></div>` : ''}
      </div>`;
  }

  /* ---------- Charts ---------- */

  function niceStep(range, count) {
    const raw = range / Math.max(count, 1);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  }
  function niceAxis(maxValue, count = 4, minValue = 0) {
    const step = niceStep(Math.max(maxValue - minValue, 1e-9), count);
    const lo = Math.floor(minValue / step) * step;
    const hi = Math.ceil(maxValue / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
    return { min: lo, max: hi, ticks };
  }
  function tickText(v) {
    if (Math.abs(v) >= 10000) return `${fmt(v / 1000, 0)}K`;
    if (Math.abs(v) >= 1000) return fmt(v, 0);
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
  }

  // One y axis per chart. Stacks of charts share the flow axis instead of using a second y axis.
  function drawChart(host, opts) {
    const width = Math.max(host.clientWidth || 640, 280);
    const height = opts.height || 170;
    const m = { l: 50, r: 14, t: 8, b: opts.showX === false ? 8 : 34 };
    const x = (v) => m.l + ((v - opts.x.min) / (opts.x.max - opts.x.min)) * (width - m.l - m.r);
    const y = (v) => height - m.b - ((v - opts.y.min) / (opts.y.max - opts.y.min)) * (height - m.t - m.b);
    const parts = [`<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(opts.label)}">`];
    opts.y.ticks.forEach((t) => {
      parts.push(`<line x1="${m.l}" x2="${width - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/>`);
      parts.push(`<text class="tick" x="${m.l - 7}" y="${y(t) + 4}" text-anchor="end">${esc(tickText(t))}</text>`);
    });
    parts.push(`<line x1="${m.l}" x2="${width - m.r}" y1="${y(opts.y.min)}" y2="${y(opts.y.min)}" stroke="var(--axis)"/>`);
    if (opts.showX !== false) {
      opts.x.ticks.forEach((t, i) => {
        const text = opts.x.labels ? opts.x.labels[i] : tickText(t);
        parts.push(`<text class="tick" x="${x(t)}" y="${height - m.b + 16}" text-anchor="middle">${esc(text)}</text>`);
      });
      if (opts.x.title) parts.push(`<text x="${(m.l + width - m.r) / 2}" y="${height - 2}" text-anchor="middle">${esc(opts.x.title)}</text>`);
    }
    opts.series.forEach((s) => {
      const pts = s.points.filter(([px, py]) => px >= opts.x.min && px <= opts.x.max && py >= opts.y.min && py <= opts.y.max);
      const d = pts.map(([px, py]) => `${x(px).toFixed(1)},${y(py).toFixed(1)}`).join(' ');
      if (d) parts.push(`<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    });
    parts.push('<g class="hover-layer"></g>');
    (opts.marks || []).forEach((mk) => {
      parts.push(`<circle cx="${x(mk.x)}" cy="${y(mk.y)}" r="5" fill="${mk.color}" stroke="var(--panel)" stroke-width="2"/>`);
      if (mk.label) {
        const textWidth = mk.label.length * 6.2;
        // In the gap to the lower left of the duty, between the fan curve and the system curve.
        if (mk.below && x(mk.x) - 34 - textWidth > m.l) {
          parts.push(`<text class="direct" x="${x(mk.x) - 34}" y="${y(mk.y) + 13}" text-anchor="end">${esc(mk.label)}</text>`);
        } else {
          const right = x(mk.x) + 9 + textWidth > width - m.r;
          parts.push(`<text class="direct" x="${x(mk.x) + (right ? -9 : 9)}" y="${y(mk.y) - 8}" text-anchor="${right ? 'end' : 'start'}">${esc(mk.label)}</text>`);
        }
      }
    });
    parts.push('</svg>');
    host.innerHTML = parts.join('');
    return { svg: host.querySelector('svg'), x, y, m, width, height, layer: host.querySelector('.hover-layer') };
  }

  function attachHover(stack, charts, rows, tooltipHtml, valuesFor) {
    let tip = stack.querySelector('.tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      tip.hidden = true;
      stack.append(tip);
    }
    const clear = () => {
      tip.hidden = true;
      charts.forEach((c) => { c.layer.innerHTML = ''; });
    };
    stack.onpointerleave = clear;
    stack.onpointermove = (event) => {
      const first = charts[0];
      const rect = first.svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      let best = 0;
      let bestGap = Infinity;
      rows.forEach((row, i) => {
        const gap = Math.abs(first.x(row.x) - px);
        if (gap < bestGap) { bestGap = gap; best = i; }
      });
      const row = rows[best];
      charts.forEach((c, chartIndex) => {
        const xPos = c.x(row.x);
        const dots = valuesFor(row, chartIndex).map((v) => `<circle cx="${xPos}" cy="${c.y(v.y)}" r="4" fill="${v.color}" stroke="var(--panel)" stroke-width="2"/>`).join('');
        c.layer.innerHTML = `<line x1="${xPos}" x2="${xPos}" y1="${c.m.t}" y2="${c.height - c.m.b}" stroke="var(--axis)"/>${dots}`;
      });
      tip.innerHTML = tooltipHtml(row);
      tip.hidden = false;
      const stackRect = stack.getBoundingClientRect();
      const tipWidth = tip.offsetWidth;
      const xInStack = first.x(row.x);
      let left = xInStack + 12;
      if (left + tipWidth > stackRect.width) left = xInStack - tipWidth - 12;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, event.clientY - stackRect.top - 40)}px`;
    };
  }

  /* ---------- Curves ---------- */

  function renderCurves() {
    const stack = $('#curveStack');
    const legend = $('#curveLegend');
    const note = $('#whatIfNote');
    $('#whatIf').value = state.whatIf;
    const message = emptyPanel();
    if (message) {
      stack.innerHTML = `<p class="panel-lead">${message}</p>`;
      legend.innerHTML = ''; note.textContent = ''; $('#whatIfValue').textContent = ''; $('#curveTable').innerHTML = '';
      return;
    }
    const ratio = state.whatIf / 100;
    const fu = flowUnit();
    const pu = pressureUnit();
    const s = result.selected;
    const showWhatIf = ratio !== 1;
    const base = result.curve;
    const alt = base.map((c) => Core.scaleByFanLaws(c, ratio));
    const dutyAlt = Core.scaleByFanLaws({ q: result.q, p: result.p, kw: s.kw, eta: s.eta }, ratio);
    $('#whatIfValue').textContent = `${state.whatIf} %`;
    note.textContent = showWhatIf
      ? `At ${fmt(s.rpm * ratio)} rpm: ${showFlow(dutyAlt.q)} ${fu.label}, ${showPressure(dutyAlt.p)} ${pu.label}, ${fmt(dutyAlt.kw, 1)} kW, from the fan laws.`
      : `Move the slider to see the effect of a speed change at ${fmt(s.rpm)} rpm.`;

    const series1 = 'var(--series-1)';
    const series2 = 'var(--series-2)';
    const series3 = 'var(--series-3)';
    legend.innerHTML = `<span><i style="background:${series1}"></i>Fan at ${fmt(s.rpm)} rpm</span>
      <span><i style="background:${series2}"></i>System curve through the duty</span>
      ${showWhatIf ? `<span><i style="background:${series3}"></i>Fan at ${fmt(s.rpm * ratio)} rpm</span>` : ''}`;

    const toQ = (si) => si / fu.toSI;
    const toP = (si) => si / pu.toSI;
    const qMax = Math.max(...base.map((c) => c.q), ...alt.map((c) => (showWhatIf ? c.q : 0)));
    const xAxis = niceAxis(toQ(qMax), 6);
    const pMax = Math.max(...base.map((c) => c.p), ...alt.map((c) => (showWhatIf ? c.p : 0)));
    const kwMax = Math.max(...base.map((c) => c.kw), ...alt.map((c) => (showWhatIf ? c.kw : 0)));
    const yP = niceAxis(toP(pMax), 4);
    const yKw = niceAxis(kwMax, 3);
    const yEta = niceAxis(100, 4);
    const sys = [];
    for (let i = 0; i <= 50; i++) {
      const q = (i / 50) * (xAxis.max * fu.toSI);
      sys.push([toQ(q), toP(result.p * (q / result.q) ** 2)]);
    }

    stack.innerHTML = `<div class="chart-title">Pressure (${esc(pu.label)})</div><div class="chart" id="chP"></div>
      <div class="chart-title">Shaft power (kW)</div><div class="chart" id="chK"></div>
      <div class="chart-title">Efficiency (%)</div><div class="chart" id="chE"></div>`;
    const line = (arr, key, scale = (v) => v) => arr.map((c) => [toQ(c.q), scale(c[key])]);
    const pct = (v) => v * 100;
    const charts = [
      drawChart($('#chP'), {
        label: 'Pressure against flow', showX: false, x: xAxis, y: yP, height: 200,
        series: [
          { color: series2, points: sys },
          { color: series1, points: line(base, 'p', toP) },
          ...(showWhatIf ? [{ color: series3, points: line(alt, 'p', toP) }] : []),
        ],
        marks: [{ x: toQ(result.q), y: toP(result.p), color: series1, below: true, label: `Duty: ${showFlow(result.q)} ${fu.label}, ${showPressure(result.p)} ${pu.label}` }],
      }),
      drawChart($('#chK'), {
        label: 'Shaft power against flow', showX: false, x: xAxis, y: yKw, height: 140,
        series: [
          { color: series1, points: line(base, 'kw') },
          ...(showWhatIf ? [{ color: series3, points: line(alt, 'kw') }] : []),
        ],
        marks: [{ x: toQ(result.q), y: s.kw, color: series1, label: `${fmt(s.kw, 1)} kW` }],
      }),
      drawChart($('#chE'), {
        label: 'Efficiency against flow', x: { ...xAxis, title: `Flow (${fu.label})` }, y: yEta, height: 170,
        series: [
          { color: series1, points: line(base, 'eta', pct) },
          ...(showWhatIf ? [{ color: series3, points: line(alt, 'eta', pct) }] : []),
        ],
        marks: [{ x: toQ(result.q), y: s.eta * 100, color: series1, label: `${fmt(s.eta * 100, 1)} %` }],
      }),
    ];
    const rows = base.map((c) => ({ x: toQ(c.q), c }));
    attachHover(stack, charts, rows,
      ({ c }) => `<div><span>Flow</span><b>${showFlow(c.q)} ${esc(fu.label)}</b></div>
        <div><span>Pressure</span><b>${showPressure(c.p)} ${esc(pu.label)}</b></div>
        <div><span>Power</span><b>${fmt(c.kw, 1)} kW</b></div>
        <div><span>Efficiency</span><b>${fmt(c.eta * 100, 1)} %</b></div>`,
      ({ c }, i) => [{ y: [toP(c.p), c.kw, c.eta * 100][i], color: series1 }]);

    const every = base.filter((_, i) => i % 8 === 0);
    $('#curveTable').innerHTML = `<table><thead><tr><th class="n">Flow (${esc(fu.label)})</th><th class="n">Pressure (${esc(pu.label)})</th><th class="n">Power (kW)</th><th class="n">Efficiency (%)</th></tr></thead>
      <tbody>${every.map((c) => `<tr><td class="n">${showFlow(c.q)}</td><td class="n">${showPressure(c.p)}</td><td class="n">${fmt(c.kw, 1)}</td><td class="n">${fmt(c.eta * 100, 1)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- Mechanical ---------- */

  function resultRow(label, value, status) {
    return `<tr><td>${label}</td><td class="n">${value}</td><td>${status ? statusPill(status, { ok: 'OK', warn: 'Check', reject: 'Fails' }) : ''}</td></tr>`;
  }
  function renderMechanical() {
    const el = $('#mechResults');
    if (guard(el)) return;
    const me = result.mech;
    const mo = result.motor;
    const s = result.selected;
    $('#mechA').placeholder = `auto ${fmt(0.4 * s.d, 2)}`;
    $('#mechL').placeholder = `auto ${fmt(0.8 * s.d, 2)}`;
    $('#mechShaft').placeholder = me.shaftAuto ? `auto ${me.shaftMm}` : 'auto';
    $('#mechMass').placeholder = `auto ${fmt(me.impellerKg)}`;
    const marginStatus = me.margin < Core.toNumber(state.mech.minMargin) ? 'reject' : 'ok';
    const torsionStatus = me.shaftMm < me.torsionMm ? 'reject' : 'ok';
    const stressStatus = me.tipStress > me.allowable ? 'reject' : 'ok';
    let startValue = 'Motor speed not set';
    let startStatus = 'warn';
    if (result.start) {
      startValue = result.start.seconds === null ? 'Cannot start' : `${fmt(result.start.seconds, 1)} s`;
      startStatus = result.start.seconds === null ? 'reject' : result.start.seconds > result.maxStart ? 'warn' : 'ok';
    }
    const w = me.weights;
    el.innerHTML = `<div class="fields">
      <h3>Results for ${esc(s.design)}, ${fmt(s.d, 2)} m</h3>
      <div class="table-wrap"><table class="result-table"><tbody>
        ${resultRow('Hot power at the shaft', `${fmt(mo.hotKw, 1)} kW`)}
        ${resultRow('Cold-start power', `${fmt(mo.coldKw, 1)} kW`)}
        ${resultRow('Highest power on the curve', `${fmt(result.maxCurveKw, 1)} kW`)}
        ${resultRow(`Motor needed, with ${esc(state.drive.motorMargin)} % margin`, `${fmt(mo.requiredKw, 1)} kW`)}
        ${resultRow('Motor selected', mo.motorKw === null ? 'None large enough' : `${fmt(mo.motorKw, mo.motorKw < 10 ? 1 : 0)} kW, ${mo.motorRpm ? `${fmt(mo.motorRpm)} rpm` : 'speed not set'}`, mo.motorKw === null ? 'reject' : 'ok')}
        ${resultRow('Starting time', startValue, startStatus)}
        ${resultRow('Shaft torque at motor rating', `${fmt(me.torque)} N·m`)}
        ${resultRow('Smallest shaft for torsion', `${fmt(me.torsionMm, 1)} mm`)}
        ${resultRow(`Shaft used${me.shaftAuto ? ' (automatic)' : ''}`, `${fmt(me.shaftMm)} mm`, torsionStatus)}
        ${resultRow('First critical speed', `${fmt(me.criticalRpm)} rpm`)}
        ${resultRow('Margin above running speed', `${fmt(me.margin, 0)} %`, marginStatus)}
        ${resultRow('Tip stress (ring estimate)', `${fmt(me.tipStress, 1)} MPa`, stressStatus)}
        ${resultRow('Allowed stress', `${fmt(me.allowable, 0)} MPa`)}
      </tbody></table></div>
      <h3>Estimated weights</h3>
      <div class="table-wrap"><table><tbody>
        <tr><td>Impeller</td><td class="n">${fmt(w.impeller)} kg</td></tr>
        <tr><td>Casing with stiffeners</td><td class="n">${fmt(w.casing)} kg</td></tr>
        <tr><td>Base and pedestal</td><td class="n">${fmt(w.base)} kg</td></tr>
        <tr><td>Shaft</td><td class="n">${fmt(w.shaft)} kg</td></tr>
        <tr class="total-row"><td>Total without motor</td><td class="n">${fmt(w.total)} kg</td></tr>
      </tbody></table></div>
      <p class="notice">These are first estimates. See Method for what they leave out.</p>
    </div>`;
  }

  /* ---------- Noise ---------- */

  function renderNoise() {
    const stack = $('#noiseStack');
    const message = emptyPanel();
    if (message) {
      stack.innerHTML = `<p class="panel-lead">${message}</p>`;
      $('#noiseLead').textContent = ''; $('#noiseLegend').innerHTML = ''; $('#noiseTable').innerHTML = '';
      return;
    }
    const n = result.noise;
    $('#noiseLead').innerHTML = `Estimated sound power is <b>${fmt(n.overall, 0)} dB</b> overall, or <b>${fmt(n.lwA, 0)} dB(A)</b>. That gives about <b>${fmt(n.lpA, 0)} dB(A)</b> at ${fmt(n.distance, 1)} m from an unsilenced fan.`;
    const s1 = 'var(--series-1)';
    const s2 = 'var(--series-2)';
    $('#noiseLegend').innerHTML = `<span><i style="background:${s1}"></i>Sound power (dB)</span><span><i style="background:${s2}"></i>A-weighted (dB(A))</span>`;
    const labels = n.bands.map((b) => (b.hz >= 1000 ? `${b.hz / 1000}k` : String(b.hz)));
    const low = Math.min(...n.bands.map((b) => b.lwA));
    const high = Math.max(...n.bands.map((b) => b.lw));
    const yAxis = niceAxis(high, 4, low);
    stack.innerHTML = '<div class="chart" id="chN"></div>';
    const chart = drawChart($('#chN'), {
      label: 'Sound power by octave band', height: 260,
      x: { min: -0.3, max: 7.3, ticks: n.bands.map((_, i) => i), labels, title: 'Octave band (Hz)' },
      y: yAxis,
      series: [
        { color: s1, points: n.bands.map((b, i) => [i, b.lw]) },
        { color: s2, points: n.bands.map((b, i) => [i, b.lwA]) },
      ],
      marks: n.bands.flatMap((b, i) => [{ x: i, y: b.lw, color: s1 }, { x: i, y: b.lwA, color: s2 }]),
    });
    attachHover(stack, [chart], n.bands.map((b, i) => ({ x: i, b })),
      ({ b }) => `<div><span>Band</span><b>${fmt(b.hz)} Hz</b></div><div><span>Sound power</span><b>${fmt(b.lw, 0)} dB</b></div><div><span>A-weighted</span><b>${fmt(b.lwA, 0)} dB(A)</b></div>`,
      ({ b }) => [{ y: b.lw, color: s1 }, { y: b.lwA, color: s2 }]);
    $('#noiseTable').innerHTML = `<table><thead><tr><th class="n">Band (Hz)</th><th class="n">Sound power (dB)</th><th class="n">A-weighted (dB(A))</th></tr></thead>
      <tbody>${n.bands.map((b) => `<tr><td class="n">${fmt(b.hz)}</td><td class="n">${fmt(b.lw, 0)}</td><td class="n">${fmt(b.lwA, 0)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- Cost and quotation ---------- */

  function quoteBody() {
    const r = result;
    const s = r.selected;
    const pr = state.project;
    const today = new Date();
    const date = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const row = (k, v) => `<tr><td style="padding:4px 8px 4px 0;border-bottom:1px solid #dde4e7;color:#4a5f68">${k}</td><td style="padding:4px 0;border-bottom:1px solid #dde4e7;text-align:right">${v}</td></tr>`;
    const table = (rows) => `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 18px">${rows.join('')}</table>`;
    const head = (t) => `<h3 style="margin:0;font-size:15px;font-weight:600">${t}</h3>`;
    const example = r.design.example
      ? `<p style="border:2px solid #a82525;color:#a82525;padding:8px 10px;font-weight:600;margin:0 0 16px">EXAMPLE ONLY. This quotation uses invented fan data and placeholder rates, so it must not be sent to a customer.</p>` : '';
    return `${example}
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:18px">
        <div><div style="font-size:21px;font-weight:700">${esc(pr.company)}</div><div style="color:#4a5f68;font-size:14px">Quotation ${esc(pr.reference)}</div></div>
        <div style="text-align:right;font-size:14px"><div>${esc(date)}</div><div style="color:#4a5f68">Valid for ${esc(pr.validDays)} days</div></div>
      </div>
      <p style="margin:0 0 16px;font-size:14px">For <b>${esc(pr.customer)}</b>: ${esc(pr.tag)}</p>
      ${head('Duty')}
      ${table([
        row('Flow', `${showFlow(r.q)} ${esc(flowUnit().label)}`),
        row('Pressure', `${showPressure(r.p)} ${esc(pressureUnit().label)} (${esc(r.design.basis)})`),
        row('Gas temperature and density', `${esc(state.duty.tempC)} °C, ${fmt(r.rho, 3)} kg/m³`),
      ])}
      ${head('Fan offered')}
      ${table([
        row('Design and type', `${esc(s.design)}, ${esc(Core.FAN_TYPES[r.design.type].label)}`),
        row('Impeller diameter', `${fmt(s.d * 1000)} mm`),
        row('Speed', `${fmt(s.rpm)} rpm`),
        row('Efficiency', `${fmt(s.eta * 100, 1)} %`),
        row('Shaft power', `${fmt(s.kw, 1)} kW`),
        row('Motor', r.motor.motorKw === null ? 'To be confirmed' : `${fmt(r.motor.motorKw, r.motor.motorKw < 10 ? 1 : 0)} kW`),
        row('Drive', r.drive.type === 'belt' ? 'Belt drive' : 'Direct drive'),
        row('Estimated weight, without motor', `${fmt(r.mech.weights.total)} kg`),
        row('Estimated sound level', `${fmt(r.noise.lpA)} dB(A) at ${fmt(r.noise.distance, 1)} m`),
      ])}
      ${head('Price')}
      ${table([
        row('Price', rupees(r.cost.price)),
        row(`GST at ${esc(state.rates.gstPercent)} %`, rupees(r.cost.tax)),
        `<tr><td style="padding:6px 8px 4px 0;font-weight:700">Total</td><td style="padding:6px 0 4px;text-align:right;font-weight:700">${rupees(r.cost.total)}</td></tr>`,
      ])}
      <p style="margin:0;color:#4a5f68;font-size:12.5px">All figures are preliminary estimates, to be confirmed by tested fan data and final engineering before order. Sound level is a typical estimate and not a guarantee.</p>`;
  }
  function quoteDocument() {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quotation ${esc(state.project.reference)}</title></head>
      <body style="margin:0;background:#ffffff;color:#15262d;font:15px/1.45 'Segoe UI',system-ui,sans-serif"><main style="max-width:720px;margin:0 auto;padding:28px 20px">${quoteBody()}</main></body></html>`;
  }
  function renderQuote() {
    const cost = $('#costBreakdown');
    const preview = $('#quotePreview');
    const message = emptyPanel();
    $('#saveQuote').disabled = Boolean(message);
    $('#printQuote').disabled = Boolean(message);
    if (message) {
      cost.innerHTML = `<p class="panel-lead">${message}</p>`;
      preview.innerHTML = '';
      return;
    }
    const c = result.cost;
    cost.innerHTML = `<h3>Cost build-up</h3><div class="table-wrap"><table><tbody>
      ${c.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="n">${rupees(l.amount)}</td></tr>`).join('')}
      <tr class="total-row"><td>Direct cost</td><td class="n">${rupees(c.direct)}</td></tr>
      <tr><td>Overhead</td><td class="n">${rupees(c.overhead)}</td></tr>
      <tr><td>Margin</td><td class="n">${rupees(c.profit)}</td></tr>
      <tr class="total-row"><td>Price before tax</td><td class="n">${rupees(c.price)}</td></tr>
      <tr><td>GST</td><td class="n">${rupees(c.tax)}</td></tr>
      <tr class="total-row"><td>Total</td><td class="n">${rupees(c.total)}</td></tr>
    </tbody></table></div>`;
    preview.innerHTML = quoteBody();
  }

  /* ---------- Drawing ---------- */

  function currentLayout() {
    const s = result.selected;
    const me = result.mech;
    const pr = state.project;
    return Core.fanLayout({
      d: s.d,
      type: result.design.type,
      overhangM: me.overhang,
      spanM: me.span,
      shaftMm: me.shaftMm,
      arrangement: me.arrangement,
      labels: [`${pr.reference}: ${pr.tag}`, `${s.design}, ${fmt(s.rpm)} rpm, ${showFlow(result.q)} ${flowUnit().label}, ${showPressure(result.p)} ${pressureUnit().label}`],
    });
  }
  function renderDrawing() {
    const el = $('#drawing');
    const message = emptyPanel();
    $('#saveDxf').disabled = Boolean(message);
    $('#saveSvg').disabled = Boolean(message);
    $('#dxfNote').hidden = !inViewer();
    if (message) { el.innerHTML = `<p class="panel-lead">${message}</p>`; return; }
    el.innerHTML = Core.toSvg(currentLayout(), { stroke: 'currentColor', textFill: 'currentColor' });
  }

  /* ---------- Fan data editor ---------- */

  function currentDesign() {
    return state.designs.find((d) => d.name === editingDesign) || state.designs[0] || null;
  }
  function uniqueName(base) {
    let name = base;
    let i = 2;
    while (state.designs.some((d) => d.name === name)) { name = `${base} ${i}`; i += 1; }
    return name;
  }
  function renderFans() {
    const el = $('#panel-fans');
    const design = currentDesign();
    if (design) editingDesign = design.name;
    const list = state.designs.map((d) => `<button type="button" class="btn design-btn" data-pick-design="${esc(d.name)}" aria-pressed="${d === design}">${esc(d.name)}</button>`).join('');
    const problems = design && result.designProblems ? result.designProblems[design.name] : null;
    const types = Object.entries(Core.FAN_TYPES).map(([k, v]) => `<option value="${k}" ${design && design.type === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const editor = design ? `
      ${design.example ? '<p class="notice"><b>This design is invented for teaching.</b> Replace it with your own tested data before real use.</p>' : ''}
      ${problems ? `<ul class="problems">${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <div class="split">
        <div class="fields">
          <div class="field"><label for="fName">Design name</label><input id="fName" class="text" value="${esc(design.name)}"></div>
          <div class="field"><label for="fType">Fan type</label><select id="fType" data-design-field="type">${types}</select></div>
          <div class="field"><label for="fBasis">Pressure basis</label><input id="fBasis" class="text" data-design-field="basis" value="${esc(design.basis)}"></div>
          <div class="two">
            <div class="field"><label for="fD">Test diameter (m)</label><input id="fD" data-design-num="refD" value="${esc(design.refD)}" inputmode="decimal"></div>
            <div class="field"><label for="fN">Test speed (rpm)</label><input id="fN" data-design-num="refRpm" value="${esc(design.refRpm)}" inputmode="decimal"></div>
          </div>
          <div class="field"><label for="fRho">Test density (kg/m³)</label><input id="fRho" data-design-num="refRho" value="${esc(design.refRho)}" inputmode="decimal"></div>
          <div class="row">
            ${confirmDelete
              ? `<span>Delete ${esc(design.name)}?</span><button type="button" class="btn btn-danger" id="deleteYes">Yes, delete</button><button type="button" class="btn" id="deleteNo">Keep it</button>`
              : '<button type="button" class="btn" id="dupDesign">Duplicate</button><button type="button" class="btn btn-danger" id="deleteDesign">Delete</button>'}
          </div>
        </div>
        <div class="fields">
          <h3>Test points, at the conditions on the left</h3>
          <div class="table-wrap"><table class="points">
            <thead><tr><th class="n">Flow (m³/s)</th><th class="n">Pressure (Pa)</th><th class="n">Efficiency (0 to 1)</th><th></th></tr></thead>
            <tbody>${design.points.map((p, i) => `<tr>
              <td><input aria-label="Flow, row ${i + 1}" data-point="${i}" data-key="q" value="${esc(p.q)}" inputmode="decimal"></td>
              <td><input aria-label="Pressure, row ${i + 1}" data-point="${i}" data-key="p" value="${esc(p.p)}" inputmode="decimal"></td>
              <td><input aria-label="Efficiency, row ${i + 1}" data-point="${i}" data-key="eta" value="${esc(p.eta)}" inputmode="decimal"></td>
              <td><button type="button" class="btn" data-remove-point="${i}" aria-label="Remove row ${i + 1}">✕</button></td>
            </tr>`).join('')}</tbody>
          </table></div>
          <div class="row"><button type="button" class="btn" id="addPoint">Add row</button></div>
          <div class="field">
            <label for="csvBox">Paste test data: flow, pressure, efficiency on each line</label>
            <textarea id="csvBox" rows="4" placeholder="2.0, 2450, 0.50&#10;3.0, 2500, 0.62"></textarea>
          </div>
          <div class="row"><button type="button" class="btn" id="importCsv">Replace rows with pasted data</button></div>
        </div>
      </div>` : '<p class="panel-lead">No fan designs yet. Add one to begin.</p>';
    el.innerHTML = `<div class="card fields">
      <div class="row space-between">
        <div class="design-list">${list}</div>
        <button type="button" class="btn btn-primary" id="addDesign">Add design</button>
      </div>
      ${editor}
    </div>`;
  }
  function parseCsv(text) {
    const rows = [];
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.trim().split(/[,;\t ]+/).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
        const eta = parts[2] > 1 ? parts[2] / 100 : parts[2];
        rows.push({ q: parts[0], p: parts[1], eta });
      }
    });
    return rows;
  }

  /* ---------- Events ---------- */

  document.addEventListener('input', (event) => {
    const t = event.target;
    if (t.dataset.path) {
      setPath(t.dataset.path, t.value);
      schedule();
      return;
    }
    if (t.id === 'whatIf') {
      state.whatIf = Number(t.value);
      schedule();
      return;
    }
    const design = currentDesign();
    if (!design) return;
    if (t.dataset.designField) {
      design[t.dataset.designField] = t.value;
      schedule();
    } else if (t.dataset.designNum) {
      design[t.dataset.designNum] = Core.toNumber(t.value);
      design.example = false;
      updateKeepingEditor();
    } else if (t.dataset.point !== undefined) {
      design.points[Number(t.dataset.point)][t.dataset.key] = Core.toNumber(t.value);
      design.example = false;
      updateKeepingEditor();
    }
  });
  // While someone types in the test data table, refresh the results without rebuilding that table.
  function updateKeepingEditor() {
    clearTimeout(frame);
    frame = setTimeout(() => {
      result = Core.analyse(state);
      renderDensity();
      renderSummary();
      saveDraft();
      const design = currentDesign();
      const panel = $('#panel-fans');
      const problems = design && result.designProblems ? result.designProblems[design.name] : null;
      let box = panel.querySelector('.problems');
      if (problems && !box) {
        box = document.createElement('ul');
        box.className = 'problems';
        panel.querySelector('.split').before(box);
      }
      if (box) {
        if (problems) box.innerHTML = problems.map((p) => `<li>${esc(p)}</li>`).join('');
        else box.remove();
      }
    }, 30);
  }

  document.addEventListener('change', (event) => {
    const t = event.target;
    if (t.id === 'fName') {
      const design = currentDesign();
      const name = t.value.trim();
      if (!name || (name !== design.name && state.designs.some((d) => d.name === name))) {
        toast('Use a design name that is not blank or already taken.');
        t.value = design.name;
        return;
      }
      if (state.selected && state.selected.design === design.name) state.selected.design = name;
      design.name = name;
      editingDesign = name;
      update();
    }
    if (t.name === 'pickFan') {
      const row = t.closest('tr');
      pickRow(row);
    }
  });

  function pickRow(row) {
    state.selected = { design: row.dataset.design, d: Number(row.dataset.d) };
    update();
  }

  document.addEventListener('click', (event) => {
    const t = event.target;
    const tab = t.closest('[data-tab]');
    if (tab) { setTab(tab.dataset.tab); return; }
    const row = t.closest('tr.pickable');
    if (row && t.tagName !== 'INPUT') { pickRow(row); return; }
    const pickDesign = t.closest('[data-pick-design]');
    if (pickDesign) {
      editingDesign = pickDesign.dataset.pickDesign;
      confirmDelete = false;
      renderFans();
      return;
    }
    const remove = t.closest('[data-remove-point]');
    if (remove) {
      const design = currentDesign();
      design.points.splice(Number(remove.dataset.removePoint), 1);
      design.example = false;
      update();
      return;
    }
    switch (t.id) {
      case 'autoPick': state.selected = null; update(); break;
      case 'toggleRejected': showRejected = !showRejected; renderSelection(); break;
      case 'addDesign': {
        const name = uniqueName('New design');
        state.designs.push({ name, type: 'backward', basis: 'Total pressure', refD: 0.8, refRpm: 1450, refRho: 1.2, example: false, points: [{ q: 1, p: 1000, eta: 0.5 }, { q: 2, p: 900, eta: 0.7 }, { q: 3, p: 600, eta: 0.6 }] });
        editingDesign = name;
        confirmDelete = false;
        update();
        toast('Added a new design with placeholder points. Replace them with your test data.');
        break;
      }
      case 'dupDesign': {
        const design = currentDesign();
        const copy = JSON.parse(JSON.stringify(design));
        copy.name = uniqueName(`${design.name} copy`);
        state.designs.push(copy);
        editingDesign = copy.name;
        update();
        break;
      }
      case 'deleteDesign': confirmDelete = true; renderFans(); break;
      case 'deleteNo': confirmDelete = false; renderFans(); break;
      case 'deleteYes': {
        const design = currentDesign();
        state.designs = state.designs.filter((d) => d !== design);
        if (state.selected && state.selected.design === design.name) state.selected = null;
        editingDesign = state.designs[0] ? state.designs[0].name : null;
        confirmDelete = false;
        update();
        break;
      }
      case 'addPoint': {
        const design = currentDesign();
        const last = design.points[design.points.length - 1] || { q: 0, p: 1000, eta: 0.6 };
        design.points.push({ q: last.q + 1, p: last.p, eta: last.eta });
        design.example = false;
        update();
        break;
      }
      case 'importCsv': {
        const rows = parseCsv($('#csvBox').value);
        if (rows.length < 3) { toast('Paste at least 3 lines of flow, pressure and efficiency.'); break; }
        const design = currentDesign();
        design.points = rows;
        design.example = false;
        update();
        toast(`Replaced the table with ${rows.length} rows.`);
        break;
      }
      case 'saveProject': saveFile(`${fileStem()}.json`, JSON.stringify(state, null, 2), 'application/json'); break;
      case 'openProject': $('#projectFile').click(); break;
      case 'resetProject':
        if (!confirmReset) {
          confirmReset = true;
          t.textContent = 'Press again to erase your work';
          setTimeout(() => { confirmReset = false; t.textContent = 'Reset to example'; }, 4000);
        } else {
          confirmReset = false;
          t.textContent = 'Reset to example';
          state = markExamples(FanDefaults());
          editingDesign = state.designs[0].name;
          syncInputs();
          update();
          toast('Back to the example project.');
        }
        break;
      case 'saveQuote': saveFile(`Quotation-${fileStem()}.html`, quoteDocument(), 'text/html'); break;
      case 'printQuote': {
        const area = $('#printArea');
        area.innerHTML = `<div style="max-width:720px;margin:0 auto;padding:12px;color:#15262d;font:15px/1.45 'Segoe UI',system-ui,sans-serif">${quoteBody()}</div>`;
        area.hidden = false;
        window.print();
        area.hidden = true;
        break;
      }
      case 'saveDxf': {
        const dxf = Core.toDxf(currentLayout());
        if (inViewer()) saveFile(`${fileStem()}-layout.dxf.txt`, dxf, 'text/plain');
        else saveFile(`${fileStem()}-layout.dxf`, dxf, 'application/dxf');
        break;
      }
      case 'saveSvg': saveFile(`${fileStem()}-layout.svg`, Core.toSvg(currentLayout(), { background: '#ffffff' }), 'image/svg+xml'); break;
      default:
    }
  });

  $('#projectFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let project = null;
      try { project = normalizeProject(JSON.parse(String(reader.result))); } catch { project = null; }
      if (!project) { toast('That file is not a MiniFan Pro project.'); return; }
      state = project;
      editingDesign = state.designs[0] ? state.designs[0].name : null;
      syncInputs();
      update();
      toast(`Opened ${file.name}`);
    };
    reader.onerror = () => toast('That file could not be read.');
    reader.readAsText(file);
  });

  document.querySelector('.tabs').addEventListener('keydown', (event) => {
    const index = TABS.indexOf(activeTab);
    if (event.key === 'ArrowRight') setTab(TABS[(index + 1) % TABS.length], true);
    else if (event.key === 'ArrowLeft') setTab(TABS[(index - 1 + TABS.length) % TABS.length], true);
    else return;
    event.preventDefault();
  });
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (TABS.includes(name)) setTab(name);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (activeTab === 'curves' || activeTab === 'noise') renderActivePanel();
    }, 150);
  });

  /* ---------- Start ---------- */

  function drawBrandBlades() {
    const parts = [];
    for (let b = 0; b < 8; b++) {
      const start = (b / 8) * 2 * Math.PI;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const a = start - 0.65 * t ** 1.5;
        const r = 14 + 30 * t;
        pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
      }
      parts.push(`<polyline points="${pts.join(' ')}"/>`);
    }
    $('#brandBlades').innerHTML = parts.join('');
  }
  function start() {
    drawBrandBlades();
    syncInputs();
    if (window.innerWidth <= 900) {
      $('#limitsCard').open = false;
      $('#driveCard').open = false;
    }
    result = Core.analyse(state);
    setTab(activeTab);
    renderDensity();
    renderSummary();
    $('#printQuote').hidden = inViewer();
  }
  start();
})();
