/* Trial version: invites the visitor to the Pro version after a while. */
const TraassFanGate = (() => {
  const FIRST_MS = 120000, AGAIN_MS = 300000;
  let box = null;
  function hide() {
    if (box) box.remove();
    box = null;
    setTimeout(show, AGAIN_MS);
  }
  function show() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'fan-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'gateTitle');
    box.innerHTML = `<div class="fan-dialog">
      <h2 id="gateTitle">Try Fan Pro free for 1 day?</h2>
      <p>This trial version handles small fans with example data. Fan Pro is the full design tool:</p>
      <ul>
        <li>Fans up to 10,000 kW, with suggestions by dust and application</li>
        <li>Blade type warnings, velocity diagrams and standard sizes</li>
        <li>Shaft, casing, material and impeller stress calculations</li>
        <li>CAD drawing from your own calculation (DXF)</li>
      </ul>
      <p class="lock-note">Create an account and confirm your email to start. For more time after the first day, contact the admin at <a href="mailto:pathakvedant001@gmail.com">pathakvedant001@gmail.com</a>.</p>
      <div class="row"><a class="btn btn-primary" id="gateYes" href="fan-pro.html#signup">Yes, start my free day</a><button class="btn" id="gateNo" type="button">Not now</button></div>
    </div>`;
    document.body.append(box);
    box.querySelector('#gateNo').onclick = hide;
    box.querySelector('#gateYes').focus();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box) hide(); });
  setTimeout(show, FIRST_MS);
  return { show };
})();
