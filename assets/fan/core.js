/* MiniFan Pro calculation engine. Pure functions only: no page or browser code.
   Built from textbook fan laws and published empirical formulas.
   Results are preliminary estimates and need checking before real use. */
const FanCore = (() => {
  'use strict';

  const G = 9.81;
  const STEEL_DENSITY = 7850; // kg/m3
  const STEEL_E = 200e9; // Pa
  const R_AIR = 287.05; // J/(kg K)

  const FLOW_UNITS = {
    m3s: { label: 'm³/s', toSI: 1 },
    m3h: { label: 'm³/h', toSI: 1 / 3600 },
    cfm: { label: 'CFM', toSI: 0.00047194745 },
  };
  const PRESSURE_UNITS = {
    pa: { label: 'Pa', toSI: 1 },
    mmwc: { label: 'mmWC', toSI: 9.80665 },
    inwg: { label: 'in WG', toSI: 249.089 },
  };
  const FAN_TYPES = {
    backward: { label: 'Backward-curved' },
    radial: { label: 'Straight radial' },
    forward: { label: 'Forward-curved' },
  };

  // IEC standard motor ratings in kW.
  const IEC_MOTORS = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55,
    75, 90, 110, 132, 160, 200, 250, 315, 355, 400, 450, 500, 560, 630, 710, 800, 900, 1000];
  const STANDARD_SHAFTS_MM = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110,
    120, 130, 140, 150, 160, 180, 200, 220, 240, 260, 280, 300];

  // Octave band corrections added to the overall level (Engineering Toolbox, fan noise).
  const OCTAVE_HZ = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
  const OCTAVE_CORRECTIONS = {
    backward: [-4, -6, -9, -11, -13, -16, -19, -22],
    forward: [-2, -6, -13, -18, -19, -22, -25, -30],
    radial: [-3, -5, -7, -7, -8, -11, -16, -18],
  };
  const A_WEIGHTING = [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1.0, -1.1];

  function isPositive(v) {
    return typeof v === 'number' && Number.isFinite(v) && v > 0;
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || v.trim() === '') return NaN;
    return Number(v);
  }

  function parseNumberList(text) {
    return String(text ?? '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  }

  /* ---------- Gas properties ---------- */

  function barometricPressure(altitudeM) {
    return 101325 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
  }

  function gasDensity(tempC, altitudeM = 0, gasConstant = R_AIR) {
    return barometricPressure(altitudeM) / (gasConstant * (tempC + 273.15));
  }

  /* ---------- Interpolation ---------- */

  function endSlope(h0, h1, del0, del1) {
    let d = ((2 * h0 + h1) * del0 - h0 * del1) / (h0 + h1);
    if (Math.sign(d) !== Math.sign(del0)) d = 0;
    else if (Math.sign(del0) !== Math.sign(del1) && Math.abs(d) > 3 * Math.abs(del0)) d = 3 * del0;
    return d;
  }

  // Shape-preserving cubic through the points, so curves never overshoot the test data.
  function pchip(xs, ys) {
    const n = xs.length;
    const h = [];
    const del = [];
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
      del[i] = (ys[i + 1] - ys[i]) / h[i];
    }
    const d = new Array(n).fill(0);
    if (n === 2) {
      d[0] = del[0];
      d[1] = del[0];
    } else {
      for (let i = 1; i < n - 1; i++) {
        if (del[i - 1] * del[i] > 0) {
          const w1 = 2 * h[i] + h[i - 1];
          const w2 = h[i] + 2 * h[i - 1];
          d[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]);
        }
      }
      d[0] = endSlope(h[0], h[1], del[0], del[1]);
      d[n - 1] = endSlope(h[n - 2], h[n - 3], del[n - 2], del[n - 3]);
    }
    return (x) => {
      let i = 0;
      while (i < n - 2 && x > xs[i + 1]) i++;
      const t = (x - xs[i]) / h[i];
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * d[i]
        + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * d[i + 1];
    };
  }

  /* ---------- Fan design model ---------- */

  function validateDesign(design) {
    const problems = [];
    if (!design || !Array.isArray(design.points)) return ['This design has no test data.'];
    if (!isPositive(design.refD)) problems.push('Enter a test diameter above 0.');
    if (!isPositive(design.refRpm)) problems.push('Enter a test speed above 0.');
    if (!isPositive(design.refRho)) problems.push('Enter a test density above 0.');
    if (design.points.length < 3) problems.push('Enter at least 3 test points.');
    let lastQ = -Infinity;
    design.points.forEach((pt, i) => {
      const row = i + 1;
      if (!isPositive(pt.q) || !isPositive(pt.p) || !isPositive(pt.eta)) {
        problems.push(`Row ${row}: flow, pressure and efficiency must be above 0.`);
      } else {
        if (pt.eta > 1) problems.push(`Row ${row}: enter efficiency as a fraction, such as 0.82.`);
        if (pt.q <= lastQ) problems.push(`Row ${row}: flow must increase down the table.`);
        lastQ = pt.q;
      }
    });
    return problems;
  }

  function buildModel(design) {
    const n0 = design.refRpm / 60;
    const phi = design.points.map((pt) => pt.q / (n0 * design.refD ** 3));
    const psi = design.points.map((pt) => pt.p / (design.refRho * n0 ** 2 * design.refD ** 2));
    const eta = design.points.map((pt) => pt.eta);
    const psiFn = pchip(phi, psi);
    const etaFn = pchip(phi, eta);
    const phiMin = phi[0];
    const phiMax = phi[phi.length - 1];

    // Walk left from the free-flow end until pressure stops rising. Left of that point
    // the curve has a positive slope, where flow can be unstable.
    const steps = 400;
    let stallPhi = phiMin;
    let prev = psiFn(phiMax);
    for (let i = steps - 1; i >= 0; i--) {
      const x = phiMin + (i / steps) * (phiMax - phiMin);
      const y = psiFn(x);
      if (y < prev) {
        stallPhi = phiMin + ((i + 1) / steps) * (phiMax - phiMin);
        break;
      }
      prev = y;
    }
    return { design, phiMin, phiMax, psiFn, etaFn, stallPhi };
  }

  // Finds where the duty's system parabola crosses the fan curve for one size.
  function sizeFan(model, qReq, pReq, rho, d) {
    const target = (pReq * d ** 4) / (rho * qReq ** 2);
    const g = (x) => model.psiFn(x) / (x * x) - target;
    const { phiMin, phiMax } = model;
    const scan = 240;
    let lo = null;
    let hi = null;
    let prevX = phiMin;
    let prevG = g(phiMin);
    if (prevG === 0) { lo = phiMin; hi = phiMin; }
    for (let i = 1; i <= scan && lo === null; i++) {
      const x = phiMin + (i / scan) * (phiMax - phiMin);
      const gx = g(x);
      if (prevG >= 0 && gx <= 0) { lo = prevX; hi = x; }
      prevX = x;
      prevG = gx;
    }
    if (lo === null) return null;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (g(mid) >= 0) lo = mid; else hi = mid;
    }
    const phi = (lo + hi) / 2;
    const eta = model.etaFn(phi);
    const n = qReq / (phi * d ** 3);
    const rpm = n * 60;
    return {
      design: model.design.name,
      d,
      rpm,
      eta,
      phi,
      kw: (qReq * pReq) / eta / 1000,
      tip: (Math.PI * d * rpm) / 60,
      leftOfPeak: phi < model.stallPhi,
      nearPeak: phi >= model.stallPhi && phi < model.stallPhi * 1.1,
    };
  }

  // The scaled fan curve at one size, speed and density.
  function curveFor(model, d, rpm, rho, count = 80) {
    const n = rpm / 60;
    const out = [];
    for (let i = 0; i <= count; i++) {
      const phi = model.phiMin + (i / count) * (model.phiMax - model.phiMin);
      const psi = model.psiFn(phi);
      const eta = model.etaFn(phi);
      const q = phi * n * d ** 3;
      const p = psi * rho * n ** 2 * d ** 2;
      out.push({ q, p, eta, kw: (q * p) / eta / 1000 });
    }
    return out;
  }

  function scaleByFanLaws(point, speedRatio, sizeRatio = 1, densityRatio = 1) {
    return {
      q: point.q * speedRatio * sizeRatio ** 3,
      p: point.p * speedRatio ** 2 * sizeRatio ** 2 * densityRatio,
      kw: point.kw * speedRatio ** 3 * sizeRatio ** 5 * densityRatio,
      eta: point.eta,
    };
  }

  /* ---------- Selection ---------- */

  function judgeRow(row, limits) {
    const flags = [];
    if (row.rpm > limits.maxRpm) flags.push({ level: 'reject', text: `Speed is above the ${limits.maxRpm} rpm limit.` });
    if (row.tip > limits.maxTip) flags.push({ level: 'reject', text: `Tip speed is above the ${limits.maxTip} m/s limit.` });
    if (row.leftOfPeak) flags.push({ level: 'reject', text: 'The duty sits left of peak pressure, where flow can be unstable.' });
    else if (row.nearPeak) flags.push({ level: 'warn', text: 'The duty is close to peak pressure. Leave more stall margin if you can.' });
    row.flags = flags;
    row.status = flags.some((f) => f.level === 'reject') ? 'reject' : flags.length ? 'warn' : 'ok';
    return row;
  }

  function selectAll(models, qReq, pReq, rho, limits) {
    const rows = [];
    const order = { ok: 0, warn: 1, reject: 2 };
    models.forEach((model) => {
      limits.sizes.forEach((d) => {
        const row = sizeFan(model, qReq, pReq, rho, d);
        if (row) rows.push(judgeRow(row, limits));
      });
    });
    rows.sort((a, b) => order[a.status] - order[b.status] || b.eta - a.eta);
    return rows;
  }

  /* ---------- Motor and drive ---------- */

  function selectMotor(requiredKw) {
    return IEC_MOTORS.find((kw) => kw >= requiredKw - 1e-9) ?? null;
  }

  function driveSuggestion(rpm, speeds) {
    const match = speeds.find((s) => Math.abs(rpm - s) / s <= 0.02);
    return match ? { direct: true, motorRpm: match } : { direct: false, motorRpm: null };
  }

  function motorAndDrive(row, rho, rhoCold, drive, speeds) {
    const driveEff = drive.type === 'belt' ? drive.beltEff / 100 : 1;
    const hotKw = row.kw;
    const coldKw = row.kw * (rhoCold / rho);
    const peakKw = Math.max(hotKw, coldKw);
    const requiredKw = (peakKw / driveEff) * (1 + drive.motorMargin / 100);
    const motorKw = selectMotor(requiredKw);
    const hint = driveSuggestion(row.rpm, speeds);
    let motorRpm;
    if (drive.type === 'direct') {
      const sorted = speeds.slice().sort((a, b) => Math.abs(a - row.rpm) - Math.abs(b - row.rpm));
      motorRpm = sorted[0] ?? null;
    } else {
      motorRpm = speeds.slice().sort((a, b) => a - b).find((s) => s >= row.rpm) ?? null;
    }
    return { driveEff, hotKw, coldKw, peakKw, requiredKw, motorKw, motorRpm, hint };
  }

  // Average acceleration method. Fan torque rises with speed squared, so its average is one third.
  function startingTime({ fanInertia, fanRpm, motorRpm, motorKw, motorInertia, peakKw, driveEff, torqueFactor }) {
    if (!isPositive(motorRpm) || !isPositive(motorKw)) return null;
    const omega = (2 * Math.PI * motorRpm) / 60;
    const ratio = fanRpm / motorRpm;
    const inertia = (motorInertia || 0) + fanInertia * ratio * ratio;
    const ratedTorque = (motorKw * 1000) / omega;
    const motorTorque = torqueFactor * ratedTorque;
    const loadTorque = ((peakKw / driveEff) * 1000) / omega / 3;
    const net = motorTorque - loadTorque;
    return { inertia, ratedTorque, motorTorque, loadTorque, seconds: net > 0 ? (inertia * omega) / net : null };
  }

  /* ---------- Mechanical estimates ---------- */

  function defaultThicknesses(d) {
    return {
      back: Math.max(4, Math.round(8 * d)),
      shroud: Math.max(3, Math.round(5 * d)),
      blade: Math.max(3, Math.round(5 * d)),
      casing: Math.max(3, Math.round(5 * d)),
    };
  }

  function estimateWeights(d, shaftMm, shaftLengthM, opts = {}) {
    const t = { ...defaultThicknesses(d), ...opts.thickness };
    const blades = opts.blades ?? 10;
    const back = (Math.PI / 4) * d * d * (t.back / 1000) * STEEL_DENSITY;
    const inlet = 0.7 * d;
    const shroud = (Math.PI / 4) * (d * d - inlet * inlet) * (t.shroud / 1000) * STEEL_DENSITY;
    const bladeSet = blades * (0.35 * d) * (0.2 * d) * (t.blade / 1000) * STEEL_DENSITY;
    const impeller = (back + shroud + bladeSet) * 1.1; // 10 % for the hub
    const meanR = 0.75 * d;
    const casingArea = 2 * Math.PI * meanR ** 2 + 2 * Math.PI * meanR * (0.5 * d);
    const casing = casingArea * (t.casing / 1000) * STEEL_DENSITY * 1.2; // 20 % for stiffeners
    const base = 0.35 * (impeller + casing);
    const shaftM = shaftMm / 1000;
    const shaft = (Math.PI / 4) * shaftM ** 2 * shaftLengthM * STEEL_DENSITY;
    return { impeller, casing, base, shaft, total: impeller + casing + base + shaft, casingArea, thickness: t };
  }

  function criticalSpeedRpm(arrangement, loadN, overhangM, spanM, shaftDiaM, e = STEEL_E) {
    const i = (Math.PI * shaftDiaM ** 4) / 64;
    const deflection = arrangement === 'centre'
      ? (loadN * spanM ** 3) / (48 * e * i)
      : (loadN * overhangM ** 2 * (spanM + overhangM)) / (3 * e * i);
    return (60 / (2 * Math.PI)) * Math.sqrt(G / deflection);
  }

  function marginPercent(criticalRpm, runningRpm) {
    return (criticalRpm / runningRpm - 1) * 100;
  }

  function minShaftForTorsion(torqueNm, tauMPa) {
    return Math.cbrt((16 * torqueNm) / (Math.PI * tauMPa * 1e6)) * 1000;
  }

  function nextStandardShaft(minMm) {
    return STANDARD_SHAFTS_MM.find((s) => s >= minMm - 1e-9) ?? null;
  }

  function mechanicalCheck(row, motor, mech) {
    const d = row.d;
    const overhang = isPositive(toNumber(mech.overhang)) ? toNumber(mech.overhang) : 0.4 * d;
    const span = isPositive(toNumber(mech.span)) ? toNumber(mech.span) : 0.8 * d;
    const arrangement = mech.arrangement === 'centre' ? 'centre' : 'overhung';
    const omega = (2 * Math.PI * row.rpm) / 60;
    const torqueKw = motor.motorKw ?? motor.requiredKw;
    const torque = (torqueKw * 1000) / omega;
    const torsionMm = minShaftForTorsion(torque, mech.tau);
    const shaftLength = (arrangement === 'centre' ? span : overhang + span) + 0.2 * d;

    const impellerAuto = estimateWeights(d, 50, shaftLength).impeller;
    const impellerKg = isPositive(toNumber(mech.impellerMass)) ? toNumber(mech.impellerMass) : impellerAuto;
    const load = impellerKg * G;

    const typed = toNumber(mech.shaft);
    let shaftMm;
    let shaftAuto = false;
    if (isPositive(typed)) {
      shaftMm = typed;
    } else {
      shaftAuto = true;
      const need = STANDARD_SHAFTS_MM.find((s) => s >= torsionMm - 1e-9
        && marginPercent(criticalSpeedRpm(arrangement, load, overhang, span, s / 1000), row.rpm) >= mech.minMargin);
      shaftMm = need ?? STANDARD_SHAFTS_MM[STANDARD_SHAFTS_MM.length - 1];
    }
    const criticalRpm = criticalSpeedRpm(arrangement, load, overhang, span, shaftMm / 1000);
    const margin = marginPercent(criticalRpm, row.rpm);
    const tipStress = (STEEL_DENSITY * row.tip ** 2) / 1e6; // thin rotating ring, MPa
    const allowable = mech.yield / mech.stressFactor;
    const weights = estimateWeights(d, shaftMm, shaftLength);
    if (isPositive(toNumber(mech.impellerMass))) {
      weights.total += impellerKg - weights.impeller;
      weights.impeller = impellerKg;
    }
    const inertiaFactor = 0.6;
    const fanInertia = inertiaFactor * impellerKg * (d / 2) ** 2;

    const flags = [];
    if (shaftMm < torsionMm) flags.push({ level: 'reject', text: `Shaft is below the ${torsionMm.toFixed(0)} mm needed for torsion.` });
    if (margin < mech.minMargin) flags.push({ level: 'reject', text: `Critical speed margin is ${margin.toFixed(0)} %, below your ${mech.minMargin} % limit.` });
    if (tipStress > allowable) flags.push({ level: 'reject', text: `Tip stress of ${tipStress.toFixed(0)} MPa is above the ${allowable.toFixed(0)} MPa allowed.` });
    return {
      arrangement, overhang, span, torque, torsionMm, shaftMm, shaftAuto, load, impellerKg, shaftLength,
      criticalRpm, margin, tipStress, allowable, weights, fanInertia, flags,
    };
  }

  /* ---------- Noise ---------- */

  function soundLevels(qM3s, pPa, type, distanceM) {
    const overall = 40 + 10 * Math.log10(qM3s) + 20 * Math.log10(pPa);
    const corrections = OCTAVE_CORRECTIONS[type] ?? OCTAVE_CORRECTIONS.backward;
    const bands = OCTAVE_HZ.map((hz, i) => {
      const lw = overall + corrections[i];
      return { hz, lw, lwA: lw + A_WEIGHTING[i] };
    });
    const lwA = 10 * Math.log10(bands.reduce((sum, b) => sum + 10 ** (b.lwA / 10), 0));
    const r = isPositive(distanceM) ? distanceM : 1;
    const lpA = lwA - 20 * Math.log10(r) - 8; // hemispherical spreading over a hard floor
    return { overall, bands, lwA, lpA, distance: r };
  }

  /* ---------- Costing ---------- */

  function estimateCost(weights, motorKw, rates) {
    const lines = [];
    const add = (label, amount) => lines.push({ label, amount });
    const fabricatedKg = weights.impeller + weights.casing + weights.base;
    add(`Steel plate, ${fabricatedKg.toFixed(0)} kg`, fabricatedKg * rates.steelPerKg);
    add(`Shaft, ${weights.shaft.toFixed(0)} kg`, weights.shaft * rates.shaftPerKg);
    const hours = fabricatedKg * rates.hoursPerKg;
    add(`Fabrication labour, ${hours.toFixed(0)} h`, hours * rates.labourPerHour);
    add('Bearings and housings', rates.bearings);
    add('Painting', weights.casingArea * rates.paintPerM2);
    if (motorKw) add(`Motor, ${motorKw} kW`, rates.motorBase + motorKw * rates.motorPerKw);
    const direct = lines.reduce((s, l) => s + l.amount, 0);
    const overhead = direct * (rates.overheadPercent / 100);
    const profit = (direct + overhead) * (rates.marginPercent / 100);
    const price = direct + overhead + profit;
    const tax = price * (rates.gstPercent / 100);
    return { lines, direct, overhead, profit, price, tax, total: price + tax };
  }

  /* ---------- General arrangement drawing (all sizes in mm) ---------- */

  function fanLayout({ d, type = 'backward', blades = 10, overhangM, spanM, shaftMm, arrangement = 'overhung', labels = [] }) {
    const D = d * 1000;
    const R = D / 2;
    const ents = [];
    const poly = (layer, pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        ents.push({ type: 'line', layer, x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] });
      }
    };
    const circle = (layer, x, y, r) => ents.push({ type: 'circle', layer, x, y, r });
    const text = (layer, x, y, h, value) => ents.push({ type: 'text', layer, x, y, h, value });
    const rect = (layer, x1, y1, x2, y2) => poly(layer, [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]);

    // Front view: a logarithmic scroll, widening clockwise from the cut-off to the outlet.
    const r0 = 0.575 * D;
    const rEnd = 0.95 * D;
    const a0 = (20 * Math.PI) / 180;
    const phiEnd = a0 - (Math.PI / 2 - 2 * Math.PI);
    const k = Math.log(rEnd / r0) / phiEnd;
    const scroll = [];
    const stepsScroll = 72;
    for (let i = 0; i <= stepsScroll; i++) {
      const phi = (i / stepsScroll) * phiEnd;
      const a = a0 - phi;
      const r = r0 * Math.exp(k * phi);
      scroll.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    poly('CASING', scroll);
    const xOut = 1.15 * D;
    const first = scroll[0];
    const last = scroll[scroll.length - 1];
    poly('CASING', [first, [xOut, first[1]], [xOut, last[1]], last]);

    circle('IMPELLER', 0, 0, R);
    circle('IMPELLER', 0, 0, 0.35 * D);
    circle('IMPELLER', 0, 0, 0.1 * D);
    circle('SHAFT', 0, 0, shaftMm / 2);
    const sweepDeg = type === 'forward' ? -35 : type === 'radial' ? 0 : 35;
    const rRoot = (type === 'forward' ? 0.4 : 0.36) * D;
    for (let b = 0; b < blades; b++) {
      const root = (b / blades) * 2 * Math.PI;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const a = root + ((sweepDeg * Math.PI) / 180) * t ** 1.5;
        const r = rRoot + (R - rRoot) * t;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      poly('IMPELLER', pts);
    }

    // Side view, with the shaft and bearings to the same scale.
    const b = 0.2 * D;
    const casingW = b + 0.25 * D;
    const bottom = r0 * Math.exp(k * (a0 + Math.PI / 2));
    const a = overhangM * 1000;
    const L = spanM * 1000;
    const x0 = xOut + 0.45 * D;
    const shaftR = shaftMm / 2;
    rect('CASING', x0, -bottom, x0 + casingW, rEnd);
    const cx = x0 + casingW / 2;
    rect('IMPELLER', cx - b / 2, -R, cx + b / 2, R);
    const bearingW = Math.max(0.09 * D, 2.2 * shaftMm);
    const bearingH = Math.max(0.16 * D, 3 * shaftMm);
    const bearing = (x) => rect('SHAFT', x - bearingW / 2, -bearingH / 2, x + bearingW / 2, bearingH / 2);
    let shaftEnd;
    let shaftStart;
    let dimText;
    if (arrangement === 'centre') {
      shaftStart = cx - L / 2 - 0.1 * D;
      shaftEnd = cx + L / 2 + 0.1 * D;
      bearing(cx - L / 2);
      bearing(cx + L / 2);
      dimText = `Bearing span L = ${L.toFixed(0)}`;
    } else {
      shaftStart = cx;
      shaftEnd = cx + a + L + 0.2 * D;
      bearing(cx + a);
      bearing(cx + a + L);
      dimText = `Overhang a = ${a.toFixed(0)}, span L = ${L.toFixed(0)}`;
    }
    rect('SHAFT', shaftStart, -shaftR, shaftEnd, shaftR);

    const th = Math.max(0.055 * D, 18);
    const yText = -bottom - 2.2 * th;
    text('TEXT', -rEnd, yText, th, `Impeller dia ${D.toFixed(0)} mm, ${blades} blades`);
    text('TEXT', x0, yText, th, `Shaft dia ${shaftMm.toFixed(0)} mm`);
    text('TEXT', x0, yText - 1.8 * th, th, dimText);
    labels.forEach((value, i) => text('TEXT', -rEnd, yText - (i + 1) * 1.8 * th, th, value));
    text('TEXT', -rEnd, yText - (labels.length + 1) * 1.8 * th, th, 'INDICATIVE LAYOUT. NOT FOR MANUFACTURE.');
    return ents;
  }

  function layoutBounds(ents) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    const take = (x, y) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };
    ents.forEach((e) => {
      if (e.type === 'line') { take(e.x1, e.y1); take(e.x2, e.y2); }
      if (e.type === 'circle') { take(e.x - e.r, e.y - e.r); take(e.x + e.r, e.y + e.r); }
      if (e.type === 'text') { take(e.x, e.y); take(e.x + e.value.length * e.h * 0.62, e.y + e.h); }
    });
    return { minX, minY, maxX, maxY };
  }

  // ASCII DXF, release 12 style: only LINE, CIRCLE and TEXT entities, sizes in mm.
  function toDxf(ents) {
    const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
    const num = (v) => v.toFixed(3);
    const clean = (s) => String(s).replace(/[^\x20-\x7E]/g, '?');
    ents.forEach((e) => {
      if (e.type === 'line') {
        out.push('0', 'LINE', '8', e.layer, '10', num(e.x1), '20', num(e.y1), '30', '0.0', '11', num(e.x2), '21', num(e.y2), '31', '0.0');
      } else if (e.type === 'circle') {
        out.push('0', 'CIRCLE', '8', e.layer, '10', num(e.x), '20', num(e.y), '30', '0.0', '40', num(e.r));
      } else if (e.type === 'text') {
        out.push('0', 'TEXT', '8', e.layer, '10', num(e.x), '20', num(e.y), '30', '0.0', '40', num(e.h), '1', clean(e.value));
      }
    });
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function toSvg(ents, { stroke = '#000000', fill = 'none', textFill = '#000000', background = '' } = {}) {
    const b = layoutBounds(ents);
    const pad = (b.maxX - b.minX) * 0.03;
    const vx = b.minX - pad;
    const vy = -b.maxY - pad;
    const vw = b.maxX - b.minX + 2 * pad;
    const vh = b.maxY - b.minY + 2 * pad;
    const sw = (vw / 900).toFixed(2);
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" role="img" aria-label="Indicative fan layout">`];
    if (background) parts.push(`<rect x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(1)}" fill="${background}"/>`);
    parts.push(`<g fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round">`);
    ents.forEach((e) => {
      if (e.type === 'line') parts.push(`<line x1="${e.x1.toFixed(1)}" y1="${(-e.y1).toFixed(1)}" x2="${e.x2.toFixed(1)}" y2="${(-e.y2).toFixed(1)}"/>`);
      if (e.type === 'circle') parts.push(`<circle cx="${e.x.toFixed(1)}" cy="${(-e.y).toFixed(1)}" r="${e.r.toFixed(1)}"/>`);
    });
    parts.push('</g>');
    ents.filter((e) => e.type === 'text').forEach((e) => {
      parts.push(`<text x="${e.x.toFixed(1)}" y="${(-e.y).toFixed(1)}" font-size="${e.h.toFixed(1)}" font-family="sans-serif" fill="${textFill}">${escapeXml(e.value)}</text>`);
    });
    parts.push('</svg>');
    return parts.join('');
  }

  /* ---------- Whole project analysis ---------- */

  function analyse(state) {
    const errors = [];
    const duty = state.duty;
    const flowUnit = FLOW_UNITS[duty.flowUnit] ?? FLOW_UNITS.m3s;
    const pressureUnit = PRESSURE_UNITS[duty.pressureUnit] ?? PRESSURE_UNITS.pa;
    const flow = toNumber(duty.flow);
    const pressure = toNumber(duty.pressure);
    const tempC = toNumber(duty.tempC);
    const altitude = toNumber(duty.altitude) || 0;
    const coldC = toNumber(duty.coldTempC);
    const override = toNumber(duty.densityOverride);

    if (!isPositive(flow)) errors.push('Enter a flow above 0.');
    if (!isPositive(pressure)) errors.push('Enter a pressure above 0.');
    if (!Number.isFinite(tempC) || tempC <= -273) errors.push('Enter a gas temperature in °C.');
    if (altitude < 0 || altitude > 8000) errors.push('Enter an altitude between 0 and 8000 m.');

    const limits = {
      maxRpm: toNumber(state.limits.maxRpm),
      maxTip: toNumber(state.limits.maxTip),
      sizes: parseNumberList(state.limits.sizes),
    };
    if (!isPositive(limits.maxRpm)) errors.push('Enter a speed limit above 0.');
    if (!isPositive(limits.maxTip)) errors.push('Enter a tip speed limit above 0.');
    if (!limits.sizes.length) errors.push('Enter at least one standard fan size.');

    const models = [];
    const designProblems = {};
    state.designs.forEach((design) => {
      const problems = validateDesign(design);
      if (problems.length) designProblems[design.name] = problems;
      else models.push(buildModel(design));
    });
    if (!models.length) errors.push('Add at least one fan design with valid test data.');
    if (errors.length) return { errors, designProblems };

    const q = flow * flowUnit.toSI;
    const p = pressure * pressureUnit.toSI;
    const rho = isPositive(override) ? override : gasDensity(tempC, altitude);
    const rhoCold = isPositive(override)
      ? override * ((tempC + 273.15) / ((Number.isFinite(coldC) ? coldC : tempC) + 273.15))
      : gasDensity(Number.isFinite(coldC) ? coldC : tempC, altitude);

    const rows = selectAll(models, q, p, rho, limits);
    const usable = rows.filter((r) => r.status !== 'reject');
    let selected = null;
    if (state.selected) {
      selected = rows.find((r) => r.design === state.selected.design && Math.abs(r.d - state.selected.d) < 1e-9) ?? null;
    }
    const best = usable[0] ?? null;
    const auto = !selected;
    if (!selected) selected = best;

    const result = { errors: [], designProblems, q, p, rho, rhoCold, limits, rows, best, selected, autoSelected: auto, tempC };
    if (!selected) return result;

    const model = models.find((m) => m.design.name === selected.design);
    const design = model.design;
    const speeds = parseNumberList(state.limits.motorSpeeds);
    const drive = {
      type: state.drive.type === 'direct' ? 'direct' : 'belt',
      beltEff: toNumber(state.drive.beltEff) || 100,
      motorMargin: toNumber(state.drive.motorMargin) || 0,
    };
    const motor = motorAndDrive(selected, rho, rhoCold, drive, speeds);
    const mechInput = {
      ...state.mech,
      tau: toNumber(state.mech.tau) || 40,
      minMargin: Number.isFinite(toNumber(state.mech.minMargin)) ? toNumber(state.mech.minMargin) : 25,
      yield: toNumber(state.mech.yield) || 250,
      stressFactor: toNumber(state.mech.stressFactor) || 2,
    };
    const mech = mechanicalCheck(selected, motor, mechInput);
    const start = startingTime({
      fanInertia: mech.fanInertia,
      fanRpm: selected.rpm,
      motorRpm: motor.motorRpm,
      motorKw: motor.motorKw,
      motorInertia: toNumber(state.drive.motorInertia) || 0,
      peakKw: motor.peakKw,
      driveEff: motor.driveEff,
      torqueFactor: toNumber(state.drive.torqueFactor) || 1.5,
    });
    const curve = curveFor(model, selected.d, selected.rpm, rho);
    const maxCurveKw = Math.max(...curve.map((c) => c.kw));
    const noise = soundLevels(q, p, design.type, toNumber(state.noise.distance));
    const rates = Object.fromEntries(Object.entries(state.rates).map(([k, v]) => [k, toNumber(v) || 0]));
    const cost = estimateCost(mech.weights, motor.motorKw, rates);

    const flags = [...selected.flags, ...mech.flags];
    if (motor.motorKw === null) flags.push({ level: 'reject', text: 'No standard motor in the list is large enough.' });
    if (drive.type === 'direct' && !motor.hint.direct) {
      flags.push({ level: 'warn', text: 'Fan speed does not match a motor speed. Use a belt drive, a VFD or another size.' });
    }
    if (drive.type === 'belt' && motor.motorRpm === null) {
      flags.push({ level: 'warn', text: 'Fan speed is above every motor speed in your list.' });
    }
    const maxStart = toNumber(state.drive.maxStart) || 15;
    if (start && start.seconds === null) flags.push({ level: 'reject', text: 'The motor cannot accelerate this fan with the torque factor entered.' });
    else if (start && start.seconds > maxStart) flags.push({ level: 'warn', text: `Starting time of ${start.seconds.toFixed(0)} s is above your ${maxStart} s limit. Check the motor data.` });
    if (tempC > 150) flags.push({ level: 'warn', text: 'Hot gas: check steel strength and bearing cooling at this temperature.' });
    if (motor.motorKw !== null && maxCurveKw / motor.driveEff > motor.motorKw) {
      flags.push({ level: 'warn', text: `Power could reach ${maxCurveKw.toFixed(1)} kW elsewhere on the curve, above the motor rating.` });
    }

    const overall = flags.some((f) => f.level === 'reject') ? 'reject' : flags.length ? 'warn' : 'ok';
    return { ...result, model, design, drive, motor, mech, start, curve, maxCurveKw, noise, cost, flags, overall, maxStart };
  }

  return {
    G, STEEL_E, FLOW_UNITS, PRESSURE_UNITS, FAN_TYPES, IEC_MOTORS, OCTAVE_HZ,
    toNumber, isPositive, parseNumberList, barometricPressure, gasDensity, pchip, validateDesign, buildModel,
    sizeFan, curveFor, scaleByFanLaws, selectAll, selectMotor, startingTime, estimateWeights, criticalSpeedRpm,
    marginPercent, minShaftForTorsion, nextStandardShaft, soundLevels, estimateCost, fanLayout, layoutBounds,
    toDxf, toSvg, analyse,
  };
})();

if (typeof module === 'object' && module.exports) module.exports = FanCore;
