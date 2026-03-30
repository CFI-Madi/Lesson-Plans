// ── Nav group expand/collapse ──────────────────────────────────
document.querySelectorAll('.nav-group-header').forEach(hdr => {
  const tog = () => hdr.closest('.nav-group').classList.toggle('open');
  hdr.addEventListener('click', tog);
  hdr.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tog(); }});
});

// ── Nav link scroll (switches to lessons view first) ──────────
document.querySelectorAll('[data-target]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    CFIApp.switchView('lessons');
    setTimeout(() => {
      const el = document.getElementById(link.dataset.target);
      if (el) { el.scrollIntoView({behavior:'smooth', block:'start'}); }
      link.closest('.nav-group')?.classList.add('open');
      if (window.innerWidth<=768) CFIApp.closeSidebar();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      trackVisit(link.dataset.target);
    }, 50);
  });
});

// ── Intersection observer for active nav ───────────────────────
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const a = document.querySelector(`.nav-link[data-target="${id}"]`);
    if (a) { a.classList.add('active'); a.closest('.nav-group')?.classList.add('open'); }
  });
}, { threshold: 0.05, rootMargin: '-50px 0px -55% 0px' });
document.querySelectorAll('section[id]').forEach(s => io.observe(s));

// ── Recently visited tracking ──────────────────────────────────



// ── Sidebar search ─────────────────────────────────────────────
const sideSearch = document.getElementById('sidebar-search');
sideSearch.addEventListener('input', () => {
  const q = sideSearch.value.trim().toLowerCase();
  document.querySelectorAll('.nav-group').forEach(grp => {
    let any = false;
    grp.querySelectorAll('.nav-link').forEach(l => {
      const match = !q || l.querySelector('.nav-link-text')?.textContent.toLowerCase().includes(q);
      l.classList.toggle('nav-hidden', !match);
      if (match) any = true;
    });
    if (grp.querySelector('.nav-group-label')?.textContent.toLowerCase().includes(q)) {
      any = true; grp.querySelectorAll('.nav-link').forEach(l => l.classList.remove('nav-hidden'));
    }
    grp.classList.toggle('nav-hidden', !any && !!q);
    if (q && any) grp.classList.add('open');
  });
});

// ── FULL-TEXT SEARCH ───────────────────────────────────────────
let searchIndex = null;
function buildSearchIndex() {
  if (searchIndex) return;
  searchIndex = [];
  document.querySelectorAll('.lesson-section[data-lesson-id]').forEach(sec => {
    const sid = sec.dataset.lessonId;
    const title = sec.querySelector('.lesson-title')?.textContent || '';
    const code = sec.querySelector('.lesson-code')?.textContent || '';
    const body = sec.querySelector('.lesson-body')?.textContent || '';
    searchIndex.push({ sid, title, code, text: (code + ' ' + title + ' ' + body).toLowerCase(), raw: body });
  });
}
const globalSearchInput = document.getElementById('global-search');
const searchPanel = document.getElementById('search-results-panel');
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlight(text, q) {
  const max = 120;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, max) + '…';
  const start = Math.max(0, idx - 40);
  const snippet = (start > 0 ? '…' : '') + text.slice(start, start + max) + '…';
  return snippet.replace(new RegExp(escapeRe(q), 'gi'), m => `<mark>${m}</mark>`);
}
globalSearchInput.addEventListener('input', () => {
  const q = globalSearchInput.value.trim();
  if (q.length < 2) { searchPanel.classList.remove('open'); return; }
  buildSearchIndex();
  const results = searchIndex.filter(r => r.text.includes(q.toLowerCase())).slice(0, 12);
  if (!results.length) {
    searchPanel.innerHTML = '<div class="sr-empty">No results found.</div>';
  } else {
    searchPanel.innerHTML = results.map(r => `
      <div class="sr-item" data-sid="${r.sid}">
        <div class="sr-item-title">${r.code ? '<b>'+r.code+'</b> — ' : ''}${r.title}</div>
        <div class="sr-item-excerpt">${highlight(r.raw, q)}</div>
      </div>`).join('');
    searchPanel.querySelectorAll('.sr-item').forEach(item => {
      item.addEventListener('click', () => {
        CFIApp.switchView('lessons');
        setTimeout(() => {
          document.getElementById(item.dataset.sid)?.scrollIntoView({behavior:'smooth', block:'start'});
          trackVisit(item.dataset.sid);
        }, 60);
        globalSearchInput.value = '';
        searchPanel.classList.remove('open');
      });
    });
  }
  searchPanel.classList.add('open');
});
document.addEventListener('click', e => { if (!globalSearchInput.contains(e.target) && !searchPanel.contains(e.target)) searchPanel.classList.remove('open'); });
globalSearchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { searchPanel.classList.remove('open'); globalSearchInput.blur(); }});

// ── COMPETENCY RATINGS ─────────────────────────────────────────
const COMP_LABELS = ['Not Started','Introduced','Practiced','Proficient','Signed Off'];





function applyCompUI(sid, lv) {
  const sec = document.querySelector(`.lesson-section[data-lesson-id="${sid}"]`);
  if (!sec) return;
  sec.querySelectorAll('.comp-pill').forEach(p => {
    const pl = parseInt(p.dataset.level);
    p.className = 'comp-pill' + (pl === lv ? ` active-${lv}` : '');
  });
  const badge = sec.querySelector(`.comp-badge-text`);
  if (badge) { badge.textContent = COMP_LABELS[lv]; badge.className = 'comp-badge-text' + (lv > 0 ? ` lv${lv}` : ''); }
  // nav dot
  const navLink = document.querySelector(`.nav-link[data-lid="${sid}"]`);
  if (navLink) {
    navLink.className = navLink.className.replace(/\bc-\w+/g, '').trim();
    if (lv === 1) navLink.classList.add('c-introduced');
    else if (lv === 2) navLink.classList.add('c-practiced');
    else if (lv === 3) navLink.classList.add('c-proficient');
    else if (lv === 4) navLink.classList.add('c-signedoff');
  }
}

function initCompetency() {
  document.querySelectorAll('.comp-pill').forEach(pill => {
    const sid = pill.dataset.sid;
    const lv = parseInt(pill.dataset.level);
    pill.addEventListener('click', () => {
      const cur = getComp(sid);
      const newLv = cur === lv ? 0 : lv;
      setComp(sid, newLv);
      if (cur < 4 && newLv >= 4) {
        CFIData.analytics.logEvent?.('lesson-completed', { lessonId: sid });
        CFIApp.notify?.('Lesson marked signed off.', { tone: 'success' });
        CFIApp.showNotice?.('Lesson signed off. The next smart step is to review endorsements or log the related flight.', [
          { label: 'Check Endorsements', onClick: () => CFIApp.switchView('endorsements') },
          { label: 'Dismiss', onClick: () => CFIApp.hideNotice?.() },
        ]);
      } else if (newLv > 0 && newLv !== cur) {
        CFIApp.notify?.('Lesson progress updated.', { tone: 'info' });
      }
      if (newLv >= 4) {
        const dateEl = document.querySelector(`.comp-date[data-sid="${sid}"]`);
        if (dateEl && !dateEl.value) { const today = new Date().toISOString().split('T')[0]; dateEl.value = today; setCompDate(sid, today); }
      }
      applyCompUI(sid, newLv);
      updateDashboardStats();
      updateGroupFractions();
      updateNavTooltip(sid);
    });
  });
  document.querySelectorAll('.comp-date').forEach(inp => {
    const sid = inp.dataset.sid;
    inp.addEventListener('change', () => setCompDate(sid, inp.value));
  });
}

function loadCompetencies() {
  document.querySelectorAll('.lesson-section[data-lesson-id]').forEach(sec => {
    const sid = sec.dataset.lessonId;
    const lv = getComp(sid);
    applyCompUI(sid, lv);
    const di = sec.querySelector(`.comp-date[data-sid="${sid}"]`);
    if (di) di.value = getCompDate(sid);
  });
}

// ── CHECKLIST & NOTES ──────────────────────────────────────────
function loadNotesAndChecks() {
  document.querySelectorAll('textarea[data-nkey]').forEach(ta => {
    const k = sk('note', ta.dataset.nkey);
    ta.value = sg(k) || '';
    ta.oninput = () => { ss(k, ta.value); updateNavTooltip(ta.closest('.lesson-section')?.dataset.lessonId); };
  });
  document.querySelectorAll('input[type="checkbox"][data-ckey]').forEach(cb => {
    const k = sk('cb', cb.dataset.ckey);
    cb.checked = sg(k) === '1';
    cb.closest('.check-row')?.classList.toggle('checked', cb.checked);
    cb.onchange = () => {
      ss(k, cb.checked ? '1' : '0');
      cb.closest('.check-row')?.classList.toggle('checked', cb.checked);
      updateGlobalProgress();
    };
  });
  updateGlobalProgress();
}
function updateGlobalProgress() {
  const cbs = [...document.querySelectorAll('input[type="checkbox"][data-ckey]')];
  const total = cbs.length, done = cbs.filter(c => c.checked).length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.querySelector('.prog-fill').style.width = pct + '%';
  document.querySelector('.sps-pct').textContent = pct + '%';
}

function updateGroupFractions() {
  document.querySelectorAll('.nav-group[data-gid]').forEach(grp => {
    const gid = grp.dataset.gid;
    const links = [...grp.querySelectorAll('.nav-link[data-lid]')];
    if (!links.length) return;
    const done = links.filter(l => getComp(l.dataset.lid) >= 4).length;
    const total = links.length;
    const fracEl = document.getElementById('nf-' + gid);
    if (!fracEl) return;
    if (done === 0) { fracEl.textContent = ''; fracEl.className = 'nav-frac'; }
    else if (done === total) { fracEl.textContent = '✓'; fracEl.className = 'nav-frac frac-done'; }
    else { fracEl.textContent = done + '/' + total; fracEl.className = 'nav-frac frac-partial'; }
  });
}

// ── NAV TOOLTIPS ───────────────────────────────────────────────
function updateNavTooltip(sid) {
  if (!sid) return;
  const link = document.querySelector(`.nav-link[data-lid="${sid}"]`);
  if (!link) return;
  let tip = link.querySelector('.nav-tooltip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'nav-tooltip'; link.appendChild(tip); }
  const lv = getComp(sid);
  const note = (sg(sk('note', sid + '-stud')) || '').trim().slice(0, 90);
  const date = getCompDate(sid);
  tip.innerHTML = `<div class="nt-comp">● ${COMP_LABELS[lv]}</div>${date ? `<div class="nt-date">${date}</div>` : ''}${note ? `<div class="nt-note">"${note}${note.length>=90?'…':''}"</div>` : ''}`;
}
function initNavTooltips() {
  document.querySelectorAll('.nav-link[data-lid]').forEach(link => {
    const sid = link.dataset.lid;
    updateNavTooltip(sid);
  });
}

// ── TIMERS ─────────────────────────────────────────────────────
const timers = {};
function initTimers() {
  document.querySelectorAll('.timer-block').forEach(block => {
    const sid = block.dataset.sid;
    const display = block.querySelector('.timer-display');
    const startBtn = block.querySelector('.start-btn');
    const stopBtn = block.querySelector('.stop-btn');
    const resetBtn = block.querySelector('.reset-btn');
    const logEl = block.querySelector('.timer-log');
    timers[sid] = { elapsed: 0, interval: null, running: false };

    function fmt(s) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
    function tick() { timers[sid].elapsed++; display.textContent = fmt(timers[sid].elapsed); }

    startBtn.addEventListener('click', () => {
      if (timers[sid].running) return;
      timers[sid].running = true;
      timers[sid].interval = setInterval(tick, 1000);
      startBtn.textContent = 'Running'; startBtn.classList.add('running');
      startBtn.disabled = true; stopBtn.disabled = false;
    });
    stopBtn.addEventListener('click', () => {
      clearInterval(timers[sid].interval); timers[sid].running = false;
      startBtn.textContent = 'Resume'; startBtn.classList.remove('running');
      startBtn.disabled = false; stopBtn.disabled = true;
      const mins = Math.round(timers[sid].elapsed / 60);
      if (mins > 0) logEl.textContent = `Last session: ${mins} min ground time`;
    });
    resetBtn.addEventListener('click', () => {
      clearInterval(timers[sid].interval); timers[sid] = { elapsed: 0, interval: null, running: false };
      display.textContent = '0:00:00'; startBtn.textContent = 'Start'; startBtn.classList.remove('running');
      startBtn.disabled = false; stopBtn.disabled = true; logEl.textContent = '';
    });
  });
}

CFIApp.register('search', {
  init() {},
  bindEvents() {},
  refresh() {
    searchIndex = null;
  },
  openLessonFromResult(sid) {
    CFIApp.switchView('lessons');
    setTimeout(() => {
      document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      trackVisit(sid);
    }, 60);
  },
});

CFIApp.register('lessons', {
  init() {
    initCompetency();
    initTimers();
  },
  bindEvents() {},
  render() {},
  refresh() {
    loadCompetencies();
    loadNotesAndChecks();
    initNavTooltips();
    updateGroupFractions();
  },
  openLesson(sid) {
    CFIApp.switchView('lessons');
    setTimeout(() => {
      document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      trackVisit(sid);
    }, 60);
  },
});

// ── FLIGHT LOG ─────────────────────────────────────────────────
