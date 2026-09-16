// Active sidebar state on scroll
  const sections = document.querySelectorAll('section[id], div[id="disclosure"]');
  const links    = document.querySelectorAll('.sidebar-item');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.sidebar-item[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.15, rootMargin: '-56px 0px 0px 0px' });

  sections.forEach(s => observer.observe(s));
// Section show/hide based on checkboxes
  function applySelections() {
    document.querySelectorAll('[data-section]').forEach(cb => {
      if (cb.disabled) return;
      const el = document.getElementById(cb.dataset.section);
      if (el) el.style.display = cb.checked ? '' : 'none';
    });
    // Sync sidebar items
    document.querySelectorAll('[data-section]').forEach(cb => {
      const link = document.querySelector('.sidebar-item[href="#' + cb.dataset.section + '"]');
      if (link) link.style.opacity = cb.checked ? '1' : '0.3';
    });
  }

  function setAll(state) {
    document.querySelectorAll('[data-section]').forEach(cb => { if (!cb.disabled) cb.checked = state; });
    applySelections();
  }

  // Apply on every checkbox change
  document.querySelectorAll('[data-section]').forEach(cb => {
    cb.addEventListener('change', applySelections);
  });

  // Apply defaults on load
  applySelections();
/* ============================================================
   QWM In Case of Everything, prototype features
   - Generic repeating entries (data-repeat / data-repeat-item)
   - Encrypted Save / Resume (Web Crypto: PBKDF2 + AES-GCM)
   - Fillable PDF generation (pdf-lib via CDN, on-demand)
   All client-side. Nothing transmitted.
   ============================================================ */
(function() {
  'use strict';

  // ─── Repeating entries ────────────────────────────────────
  function setupRepeaters() {
    document.querySelectorAll('[data-repeat]').forEach(container => {
      const items = container.querySelectorAll(':scope > [data-repeat-item]');
      if (!items.length) return;
      const template = items[0].cloneNode(true);
      template.querySelectorAll('.repeat-remove').forEach(b => b.remove());
      template.querySelectorAll('input, textarea').forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
      container._template = template;

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'repeat-add';
      addBtn.dataset.repeatAdd = '';
      const label = container.dataset.repeatLabel || 'entry';
      addBtn.textContent = '+ Add another ' + label;
      addBtn.addEventListener('click', () => addItem(container));
      container.appendChild(addBtn);
      /* v14: Duplicate-last-entry button (clones values, useful for similar accounts) */
      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'repeat-add';
      dupBtn.style.marginLeft = '.5rem';
      dupBtn.textContent = '⧉ Duplicate last ' + label;
      dupBtn.addEventListener('click', () => duplicateLastItem(container));
      container.appendChild(dupBtn);
      refreshRemoveButtons(container);
    });
  }

  function duplicateLastItem(container) {
    const items = container.querySelectorAll(':scope > [data-repeat-item]');
    if (items.length === 0) { addItem(container); return; }
    const last = items[items.length - 1];
    const clone = last.cloneNode(true);
    /* Strip any existing remove button from the clone, refreshRemoveButtons will re-add */
    const stale = clone.querySelector(':scope > .repeat-remove');
    if (stale) stale.remove();
    /* Copy values explicitly because cloneNode doesn't copy current input values */
    const srcInputs = last.querySelectorAll('input, textarea, select');
    const dstInputs = clone.querySelectorAll('input, textarea, select');
    srcInputs.forEach((src, i) => {
      const dst = dstInputs[i]; if (!dst) return;
      if (src.type === 'checkbox' || src.type === 'radio') dst.checked = src.checked;
      else dst.value = src.value;
    });
    const addBtn = container.querySelector(':scope > [data-repeat-add]');
    container.insertBefore(clone, addBtn);
    refreshRemoveButtons(container);
  }

  function addItem(container) {
    if (!container._template) return;
    const clone = container._template.cloneNode(true);
    const addBtn = container.querySelector(':scope > [data-repeat-add]');
    container.insertBefore(clone, addBtn);
    refreshRemoveButtons(container);
  }

  function refreshRemoveButtons(container) {
    const items = container.querySelectorAll(':scope > [data-repeat-item]');
    items.forEach(item => {
      let existing = item.querySelector(':scope > .repeat-remove');
      if (items.length <= 1) {
        if (existing) existing.remove();
      } else if (!existing) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'repeat-remove';
        rm.textContent = '× remove';
        rm.addEventListener('click', () => {
          item.remove();
          refreshRemoveButtons(container);
        });
        item.appendChild(rm);
      }
    });
  }

  function getRepeaterCounts() {
    const counts = {};
    document.querySelectorAll('[data-repeat]').forEach(c => {
      counts[c.dataset.repeat] = c.querySelectorAll(':scope > [data-repeat-item]').length;
    });
    return counts;
  }

  function setRepeaterCounts(counts) {
    Object.entries(counts || {}).forEach(([name, count]) => {
      const c = document.querySelector('[data-repeat="' + name + '"]');
      if (!c || !c._template) return;
      let cur = c.querySelectorAll(':scope > [data-repeat-item]').length;
      while (cur < count) { addItem(c); cur++; }
      while (cur > count) {
        const items = c.querySelectorAll(':scope > [data-repeat-item]');
        items[items.length - 1].remove();
        cur--;
      }
      refreshRemoveButtons(c);
    });
  }

  // ─── Snapshot / restore ───────────────────────────────────
  function getDataInputs() {
    const list = [];
    document.querySelectorAll('input[type="text"], input[type="checkbox"], textarea').forEach(el => {
      if (el.closest('.selector-panel, .nav-bar, .qwm-modal-overlay')) return;
      list.push(el);
    });
    return list;
  }

  function snapshot() {
    const subitems = {};
    document.querySelectorAll('[data-subitem-cb]').forEach(cb => {
      subitems[cb.getAttribute('data-subitem-cb')] = !!cb.checked;
    });
    return {
      v: 2,
      repeaters: getRepeaterCounts(),
      subitems: subitems,
      vals: getDataInputs().map(el => el.type === 'checkbox' ? !!el.checked : el.value)
    };
  }

  function restore(data) {
    if (data.subitems) {
      Object.keys(data.subitems).forEach(function (id) {
        const cb = document.querySelector('[data-subitem-cb="' + id + '"]');
        if (cb) cb.checked = !!data.subitems[id];
      });
    }
    setRepeaterCounts(data.repeaters || {});
    const inputs = getDataInputs();
    (data.vals || []).forEach((v, i) => {
      if (i >= inputs.length) return;
      if (inputs[i].type === 'checkbox') inputs[i].checked = !!v;
      else inputs[i].value = v;
    });
    if (typeof applySelections === 'function') applySelections();
    if (typeof window.applySubitemVisibility === 'function') window.applySubitemVisibility();
  }

  // ─── Web Crypto (PBKDF2 → AES-GCM) ────────────────────────
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const b64 = u8 => btoa(String.fromCharCode.apply(null, u8));
  const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function deriveKey(password, salt) {
    const km = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      km,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  async function encryptPayload(obj, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await deriveKey(password, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))
    ));
    return {
      app: 'QWM-InCaseOfEverything', v: 1,
      kdf: 'pbkdf2-sha256-250000', cipher: 'aes-gcm-256',
      salt: b64(salt), iv: b64(iv), ct: b64(ct)
    };
  }

  async function decryptPayload(file, password) {
    const key = await deriveKey(password, ub64(file.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ub64(file.iv) }, key, ub64(file.ct)
    );
    return JSON.parse(dec.decode(plain));
  }

  // ─── File helpers ─────────────────────────────────────────
  function downloadFile(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 200);
  }

  function readJSONFile() {
    return new Promise((resolve, reject) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.qwm,.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) { reject(new Error('No file selected')); return; }
        const r = new FileReader();
        r.onload = () => {
          try { resolve(JSON.parse(r.result)); }
          catch { reject(new Error('That file is not a valid QWM progress file.')); }
        };
        r.onerror = () => reject(new Error('Could not read the selected file.'));
        r.readAsText(f);
      };
      inp.click();
    });
  }

  // ─── Password modal ───────────────────────────────────────
  function askPassword(title, requireConfirm, initialError, hint) {
    return new Promise((resolve, reject) => {
      const ov = document.createElement('div');
      ov.className = 'qwm-modal-overlay';
      ov.innerHTML =
        '<div class="qwm-modal" role="dialog" aria-modal="true">' +
          '<h3></h3>' +
          (hint ? '<div class="qwm-modal-hint"></div>' : '') +
          '<input type="password" class="qwm-pw1" placeholder="Password" autocomplete="new-password">' +
          (requireConfirm ? '<input type="password" class="qwm-pw2" placeholder="Confirm password" autocomplete="new-password">' : '') +
          '<div class="qwm-modal-err"></div>' +
          '<div class="qwm-modal-actions">' +
            '<button type="button" class="qwm-modal-cancel">Cancel</button>' +
            '<button type="button" class="qwm-modal-ok">OK</button>' +
          '</div>' +
        '</div>';
      ov.querySelector('h3').textContent = title;
      if (hint) ov.querySelector('.qwm-modal-hint').textContent = hint;
      const errEl = ov.querySelector('.qwm-modal-err');
      errEl.textContent = initialError || '';
      const pw1 = ov.querySelector('.qwm-pw1');
      const pw2 = requireConfirm ? ov.querySelector('.qwm-pw2') : null;
      document.body.appendChild(ov);
      const cleanup = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
      const cancel = () => { cleanup(); reject(new Error('Cancelled')); };
      const submit = () => {
        const v1 = pw1.value;
        const v2 = pw2 ? pw2.value : v1;
        if (!v1) { errEl.textContent = 'Password required.'; return; }
        if (requireConfirm && v1 !== v2) { errEl.textContent = "Passwords don't match."; return; }
        if (requireConfirm && v1.length < 8) { errEl.textContent = 'Use at least 8 characters.'; return; }
        cleanup();
        resolve(v1);
      };
      ov.querySelector('.qwm-modal-cancel').addEventListener('click', cancel);
      ov.querySelector('.qwm-modal-ok').addEventListener('click', submit);
      ov.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      pw1.focus();
    });
  }

  // ─── Save / Resume ────────────────────────────────────────
  async function saveProgress() {
    let pw;
    try {
      pw = await askPassword(
        'Save your progress',
        true,
        '',
        'Choose a password to encrypt your saved file. You will need this same password to resume later. No one, including Quarters Wealth Management, LLC, can recover it for you if lost.'
      );
    } catch { return; }
    try {
      const payload = await encryptPayload(snapshot(), pw);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(JSON.stringify(payload, null, 2), 'QWM-Progress-' + stamp + '.qwm', 'application/json');
    } catch (e) {
      console.error(e);
      showDocumentStatus('Could not save: ' + (e.message || e), true);
    }
  }

  async function loadProgress() {
    let file;
    try { file = await readJSONFile(); }
    catch (e) { if (e.message && e.message !== 'No file selected') showDocumentStatus(e.message, true); return; }
    if (!file || !file.ct || !file.salt || !file.iv) {
      showDocumentStatus('That file does not look like a QWM progress file.', true);
      return;
    }
    let err = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      let pw;
      try {
        pw = await askPassword('Enter password to resume', false, err, 'Enter the password you set when you saved this file.');
      } catch { return; }
      try {
        const data = await decryptPayload(file, pw);
        restore(data);
        if (typeof window.hideWelcome === 'function') window.hideWelcome();
        return;
      } catch {
        err = 'Wrong password. Try again.';
      }
    }
    showDocumentStatus('Too many failed attempts.', true);
  }


  // Expose to global scope so onclick handlers can call them
  window.saveProgress = saveProgress;
  window.loadProgress = loadProgress;

  // Init repeaters when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRepeaters);
  } else {
    setupRepeaters();
  }
})();
/* v12 Welcome screen, section + sub-item selection */
(function () {
  const QUICK_START = ['opening','s1','s2','s3','s4','s5','s6','s7','s9','s10','disclosure'];
  const ALL_SECTIONS = ['opening','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','disclosure'];

  function setSectionChecks(sections) {
    document.querySelectorAll('[data-welcome-section]').forEach(cb => {
      if (cb.disabled) return;
      cb.checked = sections.indexOf(cb.dataset.welcomeSection) !== -1;
    });
  }
  function setAllSubitems(checked) {
    document.querySelectorAll('[data-subitem-cb]').forEach(cb => { cb.checked = checked; });
  }

  window.welcomePreset = function (name) {
    if (name === 'quickstart')      { setSectionChecks(QUICK_START); setAllSubitems(true); }
    else if (name === 'all')        { setSectionChecks(ALL_SECTIONS); setAllSubitems(true); }
    else if (name === 'none')       { setSectionChecks([]); }
  };

  window.toggleExpand = function (btn) {
    const sec = btn.dataset.expandFor;
    const panel = document.querySelector('[data-subitems-for="' + sec + '"]');
    if (!panel) return;
    if (panel.hidden) { panel.hidden = false; btn.classList.add('expanded'); }
    else              { panel.hidden = true;  btn.classList.remove('expanded'); }
  };

  window.applySubitemVisibility = function () {
    document.querySelectorAll('[data-subitem]').forEach(start => {
      const id = start.getAttribute('data-subitem');
      const cb = document.querySelector('[data-subitem-cb="' + id + '"]');
      const visible = !cb || cb.checked;
      let cur = start;
      while (cur) {
        const next = cur.nextElementSibling;
        if (cur !== start && cur.hasAttribute && cur.hasAttribute('data-subitem')) break;
        cur.style.display = visible ? '' : 'none';
        cur = next;
      }
    });
  };

  window.welcomeBegin = function () {
    document.querySelectorAll('[data-welcome-section]').forEach(w => {
      const sec = w.dataset.welcomeSection;
      const top = document.querySelector('[data-section="' + sec + '"]');
      if (top && !top.disabled) top.checked = w.checked;
    });
    if (typeof applySelections === 'function') applySelections();
    if (typeof window.applySubitemVisibility === 'function') window.applySubitemVisibility();
    hideWelcome();
  };

  window.hideWelcome = function () {
    const w = document.getElementById('welcomeScreen');
    if (!w) return;
    w.classList.add('welcome-out');
    setTimeout(function () {
      w.style.display = 'none';
      document.documentElement.classList.remove('embedded-welcome-active');
      window.scrollTo(0, 0);
    }, 350);
  };

  function init() {
    // Sub-items default to checked in the HTML; main sections start unchecked.
    // Auto-expand a section's sub-item panel when the user checks the section.
    document.querySelectorAll('[data-welcome-section]').forEach(function (cb) {
      if (cb.disabled) return;
      cb.addEventListener('change', function () {
        var sec = cb.dataset.welcomeSection;
        var panel = document.querySelector('[data-subitems-for="' + sec + '"]');
        var btn = document.querySelector('[data-expand-for="' + sec + '"]');
        if (!panel) return;
        if (cb.checked && panel.hidden) {
          panel.hidden = false;
          if (btn) btn.classList.add('expanded');
        } else if (!cb.checked && !panel.hidden) {
          panel.hidden = true;
          if (btn) btn.classList.remove('expanded');
        }
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* v12 Selector dropdown toggle */
(function () {
  window.toggleSelectorMenu = function () {
    var menu = document.getElementById('selectorMenu');
    var toggle = document.querySelector('.selector-toggle');
    if (!menu || !toggle) return;
    if (menu.hidden) {
      menu.hidden = false;
      toggle.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      menu.hidden = true;
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('click', function (e) {
    var panel = document.getElementById('selectorPanel');
    if (!panel) return;
    if (!panel.contains(e.target)) {
      var menu = document.getElementById('selectorMenu');
      var toggle = document.querySelector('.selector-toggle');
      if (menu && !menu.hidden) menu.hidden = true;
      if (toggle) { toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    }
  });

  /* v9, Back to topic selection */
  window.welcomeBack = function () {
    var w = document.getElementById('welcomeScreen');
    if (!w) return;
    w.style.display = '';
    w.classList.remove('welcome-out');
    if (new URLSearchParams(location.search).get('embedded') === '1') {
      document.documentElement.classList.add('embedded-welcome-active');
    }
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
    var menu = document.getElementById('selectorMenu');
    if (menu) menu.hidden = true;
    var toggle = document.querySelector('.selector-toggle');
    if (toggle) { toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  };
})();
/* Dark mode is handled by the toggleDarkMode() function below (called via onclick).
   Mobile-menu wiring continues here. */
(function() {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.querySelector('.sidebar');
  
  if (hamburger) {
    hamburger.addEventListener('click', function(e) {
      e.stopPropagation();
      hamburger.classList.toggle('open');
      if (sidebar) sidebar.classList.toggle('mobile-open');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function() {
      hamburger.classList.remove('open');
      if (sidebar) sidebar.classList.remove('mobile-open');
    });
    
    // Don't close when clicking sidebar
    if (sidebar) {
      sidebar.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }
  }
})();
/* Mobile Menu Toggle */
function toggleMobileMenu() {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger && sidebar) {
    hamburger.classList.toggle('open');
    sidebar.classList.toggle('mobile-open');
  }
}

/* Section Collapse/Expand, v14 fix: operate on direct children of .section-block,
   skipping .section-header. The original .section-content wrapper was never added
   to the HTML, so the v13 implementation found nothing and silently did nothing. */
function setSectionCollapsed(section, collapsed) {
  if (!section) return;
  section.classList.toggle('section-collapsed', collapsed);
  Array.prototype.forEach.call(section.children, function (child) {
    if (child.classList && child.classList.contains('section-header')) return;
    child.style.display = collapsed ? 'none' : '';
  });
  var caret = section.querySelector('.section-toggle');
  if (caret) {
    caret.classList.toggle('collapsed', collapsed);
    caret.textContent = collapsed ? '▸' : '▾';
  }
}
function toggleSectionCollapse(button) {
  var section = button.closest('.section-block');
  if (!section) return;
  setSectionCollapsed(section, !section.classList.contains('section-collapsed'));
}
function collapseAllSections() {
  document.querySelectorAll('.section-block').forEach(function (s) { setSectionCollapsed(s, true); });
}
function expandAllSections() {
  document.querySelectorAll('.section-block').forEach(function (s) { setSectionCollapsed(s, false); });
}

/* Duplicate Repeater Block */
function duplicateRepeaterBlock(button) {
  const block = button.closest('.repeater-block');
  if (!block) return;
  const clone = block.cloneNode(true);
  const allInputs = clone.querySelectorAll('input, textarea');
  allInputs.forEach(input => input.value = '');
  block.parentNode.insertBefore(clone, block.nextSibling);
  if (typeof setupRepeaters === 'function') setupRepeaters();
}

/* Toggle Dark Mode */
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark-mode');
  const isDark = document.documentElement.classList.contains('dark-mode');
  /* v14: persistence intentionally removed (user opted out of localStorage). */
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
}
/* ════════════════════════════════════════════════════════════ */
/* ─────────────────────── v14 SCRIPTS ─────────────────────── */
/* ════════════════════════════════════════════════════════════ */
(function () {

  /* ── Welcome counter: "X of 10 sections selected" ───────── */
  function countSelectableSections() {
    return document.querySelectorAll('[data-welcome-section]:not([disabled])').length;
  }
  function updateWelcomeCounter() {
    var el = document.getElementById('welcomeCounter');
    if (!el) return;
    var total = countSelectableSections();
    var sel = document.querySelectorAll('[data-welcome-section]:not([disabled]):checked').length;
    el.textContent = sel + ' of ' + total + ' sections selected';
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.matches && e.target.matches('[data-welcome-section]')) updateWelcomeCounter();
  });
  /* v14 fix: welcomePreset() flips checkboxes programmatically, which doesn't
     fire a change event. Wrap it so the counter still updates. */
  if (typeof window.welcomePreset === 'function') {
    var _origPreset = window.welcomePreset;
    window.welcomePreset = function () {
      var r = _origPreset.apply(this, arguments);
      updateWelcomeCounter();
      return r;
    };
  }

  /* ── addIncomeRow: append a blank tr to #incomeTable ─────── */
  window.addIncomeRow = function () {
    var tbody = document.querySelector('#incomeTable tbody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input aria-label="Income source name" type="text"/></td>' +
      '<td><select aria-label="Income source type"><option value=""></option><option>Pension</option><option>Social Security</option><option>Annuity</option><option>Rental</option><option>Other</option></select></td>' +
      '<td><input aria-label="Monthly amount" type="text"/></td><td><input aria-label="Notes" type="text"/></td>';
    tbody.appendChild(tr);
  };

  function showDocumentStatus(message, isError) {
    var status = document.getElementById('documentStatus');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  /* ── resetForm: two-step in-page confirmation ─────────────── */
  var resetArmed = false;
  var resetTimer = null;
  window.resetForm = function () {
    var button = document.getElementById('resetFormBtn');
    if (!resetArmed) {
      resetArmed = true;
      if (button) button.textContent = 'Confirm Reset';
      showDocumentStatus('Press Confirm Reset within 8 seconds to clear every field. This cannot be undone.', true);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        resetArmed = false;
        if (button) button.textContent = 'Reset';
        showDocumentStatus('');
      }, 8000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    if (button) button.textContent = 'Reset';
    document.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(function (el) {
      if (el.closest('.selector-panel, .nav-bar, .qwm-modal-overlay, .welcome-screen')) return;
      el.value = '';
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(function (el) {
      if (el.disabled) return;
      if (el.closest('.selector-panel, .nav-bar, .qwm-modal-overlay, .welcome-screen')) return;
      el.checked = false;
    });
    document.querySelectorAll('select').forEach(function (el) {
      if (el.closest('.selector-panel, .nav-bar, .qwm-modal-overlay, .welcome-screen')) return;
      el.selectedIndex = 0;
    });
    removeCoverPhoto();
    var ind = document.getElementById('lastLoadedIndicator');
    if (ind) ind.textContent = '';
    showDocumentStatus('All fields have been cleared.');
  };



  /* ── Last loaded indicator (in-memory only) ────────────────── */
  window.markLastLoaded = function (whenISO) {
    var ind = document.getElementById('lastLoadedIndicator');
    if (!ind) return;
    var d = whenISO ? new Date(whenISO) : new Date();
    ind.textContent = 'Last loaded: ' + d.toLocaleString();
  };
  /* Wrap loadProgress so we can decorate it without editing its body */
  if (typeof window.loadProgress === 'function') {
    var _origLoad = window.loadProgress;
    window.loadProgress = async function () {
      var result = await _origLoad.apply(this, arguments);
      try { window.markLastLoaded(); } catch (e) {}
      return result;
    };
  }

  function triggerPdfDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      link.remove();
      URL.revokeObjectURL(url);
    }, 3000);
  }

  /* ── Direct PDF download (sandbox-safe; no print dialog) ──── */
  var pdfExporting = false;
  window.confirmAndPrint = async function () {
    if (pdfExporting) return;
    var button = document.getElementById('pdfDownloadBtn');
    var main = document.querySelector('.main');
    var coverInputs = document.querySelectorAll('.cover input[type="text"]');
    var nameInput = coverInputs.length ? coverInputs[0] : null;
    var nameMissing = !!(nameInput && !nameInput.value.trim());
    var wasDark = document.documentElement.classList.contains('dark-mode');
    var collapsed = [];
    var textareaStyles = [];
    var exportHeader = null;

    pdfExporting = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Creating PDF…';
    }
    showDocumentStatus(nameMissing
      ? 'Preparing your PDF. The “Prepared by” field is blank, so the downloaded copy will not include a name.'
      : 'Preparing your completed organizer. This may take a moment.');

    try {
      if (typeof html2pdf !== 'function') throw new Error('PDF generator unavailable');
      if (wasDark) document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.add('pdf-exporting');

      document.querySelectorAll('.section-content').forEach(function (content) {
        collapsed.push({ element: content, hadClass: content.classList.contains('collapsed') });
        content.classList.remove('collapsed');
      });
      document.querySelectorAll('.section-toggle').forEach(function (toggle) {
        collapsed.push({ element: toggle, hadClass: toggle.classList.contains('collapsed') });
        toggle.classList.remove('collapsed');
      });
      main.querySelectorAll('textarea').forEach(function (textarea) {
        textareaStyles.push({ element: textarea, height: textarea.style.height, overflow: textarea.style.overflow });
        textarea.style.height = Math.max(textarea.scrollHeight, 44) + 'px';
        textarea.style.overflow = 'hidden';
      });

      var printHeader = document.querySelector('.print-header');
      if (printHeader) {
        exportHeader = printHeader.cloneNode(true);
        exportHeader.setAttribute('aria-hidden', 'true');
        main.insertBefore(exportHeader, main.firstChild);
      }

      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });

      var worker = html2pdf().set({
        margin: [0.3, 0.3, 0.35, 0.3],
        filename: 'QWM-In-Case-of-Everything-Completed.pdf',
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 1.35,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          logging: false,
          windowWidth: 816
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['.field-row', '.account-block', '.repeater-block', '.contact-card', 'tr']
        }
      }).from(main).toPdf();
      var blob = await worker.outputPdf('blob');
      triggerPdfDownload(blob, 'QWM-In-Case-of-Everything-Completed.pdf');
      showDocumentStatus(nameMissing
        ? 'Your completed PDF has been downloaded. Note: the “Prepared by” field was blank.'
        : 'Your completed PDF has been downloaded.');
    } catch (error) {
      console.error(error);
      showDocumentStatus('The PDF could not be created. Please use the blank PDF from the Resources page instead.', true);
    } finally {
      if (exportHeader) exportHeader.remove();
      textareaStyles.forEach(function (item) {
        item.element.style.height = item.height;
        item.element.style.overflow = item.overflow;
      });
      collapsed.forEach(function (item) {
        item.element.classList.toggle('collapsed', item.hadClass);
      });
      document.documentElement.classList.remove('pdf-exporting');
      if (wasDark) document.documentElement.classList.add('dark-mode');
      if (button) {
        button.disabled = false;
        button.textContent = 'Download Completed PDF';
      }
      pdfExporting = false;
    }
  };

  /* ── Cover photo (in-memory only, no storage) ──────────────── */
  window.handleCoverPhoto = function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showDocumentStatus('Please choose an image file.', true); return; }
    var img = document.getElementById('coverPhotoImg');
    var rm  = document.getElementById('coverPhotoRemove');
    var url = URL.createObjectURL(file);
    img.src = url;
    img.classList.add('has-image');
    if (rm) rm.classList.add('show');
  };
  window.removeCoverPhoto = function () {
    var img = document.getElementById('coverPhotoImg');
    var rm  = document.getElementById('coverPhotoRemove');
    var input = document.getElementById('coverPhotoInput');
    if (img) { img.src = ''; img.classList.remove('has-image'); }
    if (rm) rm.classList.remove('show');
    if (input) input.value = '';
  };

  /* ── Init counter once DOM ready (and after welcome inits) ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateWelcomeCounter);
  } else {
    updateWelcomeCounter();
  }
})();

/* Embedded organizer: grow the parent iframe to the document's full content height.
   The parent page remains the only scroll container. */
(function () {
  'use strict';
  if (new URLSearchParams(window.location.search).get('embedded') !== '1') return;

  var lastHeight = 0;
  var lastWelcomeActive = null;
  var frameRequest = 0;

  function contentHeight() {
    var welcome = document.getElementById('welcomeScreen');
    var welcomeActive = !!(welcome && getComputedStyle(welcome).display !== 'none');
    if (welcomeActive) return Math.ceil(Math.max(welcome.scrollHeight, welcome.offsetHeight));
    return Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  }

  function reportHeight() {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(function () {
      var height = contentHeight();
      var welcome = document.getElementById('welcomeScreen');
      var welcomeActive = !!(welcome && getComputedStyle(welcome).display !== 'none');
      if (!height || (height === lastHeight && welcomeActive === lastWelcomeActive)) return;
      lastHeight = height;
      lastWelcomeActive = welcomeActive;
      window.parent.postMessage({ type: 'qwm-organizer-size', height: height, welcomeActive: welcomeActive }, '*');
    });
  }

  window.addEventListener('message', function (event) {
    if (event.source === window.parent && event.data && event.data.type === 'qwm-organizer-measure') {
      lastHeight = 0;
      reportHeight();
    }
  });
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);

  if (window.ResizeObserver) {
    var resizeObserver = new ResizeObserver(reportHeight);
    resizeObserver.observe(document.body);
  }
  var mutationObserver = new MutationObserver(reportHeight);
  mutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true });

  reportHeight();
})();
