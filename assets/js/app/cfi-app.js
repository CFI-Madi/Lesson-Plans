let students = getStudents();
let activeId = getActiveId();

// ── Dark mode ──────────────────────────────────────────────────
const darkBtn = document.getElementById('btn-dark');
const applyTheme = t => {
  document.documentElement.setAttribute('data-theme', t);
  const icon = t === 'dark' ? '☀' : '☾';
  if (darkBtn) darkBtn.textContent = icon;
  const sdb = document.getElementById('settings-dark-btn');
  if (sdb) sdb.textContent = (t === 'dark' ? '☀' : '☾') + ' Toggle Dark Mode';
  CFIData.settings.setTheme(t);
};
darkBtn?.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
applyTheme(CFIData.settings.getTheme());

// ── Sidebar toggle ─────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const hamburger = document.getElementById('hamburger');
const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('active'); };
const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); };
hamburger.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
overlay.addEventListener('click', closeSidebar);

// ── View switching ─────────────────────────────────────────────
const views = { home: document.getElementById('home'), endorsements: document.getElementById('endorsements'), flightlog: document.getElementById('flight-log-full'), history: document.getElementById('session-history'), quiz: document.getElementById('pre-solo-quiz'), standards: document.getElementById('standards'), tools: document.getElementById('flight-tools'), lessons: document.getElementById('lessons-content') };
function switchView(name) {
  Object.entries(views).forEach(([k, el]) => { if (!el) return; el.classList.toggle('hidden-view', k !== name); el.classList.toggle('active-view', k === name); });
  document.querySelectorAll('.nav-special-link').forEach(l => l.classList.toggle('active', l.dataset.view === name));
  if (name === 'home') renderDashboard();
  if (name === 'endorsements') renderEndorsements();
  if (name === 'flightlog') renderFlightLog();
  if (name === 'history') renderSessionHistory();
  if (name === 'quiz') initPreSoloQuiz();
  if (name === 'standards') renderStandards();
  if (name === 'tools') initFlightTools();
}
document.querySelectorAll('.nav-special-link').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); switchView(l.dataset.view); if (window.innerWidth<=768) closeSidebar(); });
});
// "View all flights" and flight-log-full
document.getElementById('dash-view-all-flights').addEventListener('click', e => { e.preventDefault(); switchView('flightlog'); renderFlightLog(); });

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
    switchView('lessons');
    setTimeout(() => {
      const el = document.getElementById(link.dataset.target);
      if (el) { el.scrollIntoView({behavior:'smooth', block:'start'}); }
      link.closest('.nav-group')?.classList.add('open');
      if (window.innerWidth<=768) closeSidebar();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      trackVisit(link.dataset.target);
    }, 50);
  });
});

// ── Back to top ────────────────────────────────────────────────
document.getElementById('btn-top').addEventListener('click', () => document.getElementById('main').scrollTo({top:0,behavior:'smooth'}));

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
        switchView('lessons');
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

// ── FLIGHT LOG ─────────────────────────────────────────────────
const GRADES = ['','Introduced (1)','Demonstrated (2)','Practiced (3)','Satisfactory (4)'];
const GRADE_SHORT = ['','Intro','Demo','Prac','Sat'];



// Feature 2: flight type tag helpers
function flightTags(f) {
  const tags = [];
  if (f.dual)    tags.push('<span class="flt-tag dual">D</span>');
  if (f.solo)    tags.push('<span class="flt-tag solo">S</span>');
  if (f.night)   tags.push('<span class="flt-tag night">N</span>');
  if (f.xc)      tags.push('<span class="flt-tag xc">XC</span>');
  if (f.sim)     tags.push('<span class="flt-tag sim">IR</span>');
  if (f.nightTos)tags.push('<span class="flt-tag night">NT</span>');
  return tags.join('');
}

function renderFlightLog() {
  const flights = getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const tbody = document.getElementById('fl-tbody');
  const empty = document.getElementById('fl-empty');
  if (!tbody) return;
  if (!flights.length) { tbody.innerHTML = ''; if(empty) empty.classList.add('show'); return; }
  if(empty) empty.classList.remove('show');
  tbody.innerHTML = flights.map((f,i) => `<tr>
    <td>${f.date||''}</td>
    <td>${f.aircraft||''}</td>
    <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.lessonTitle||''}</td>
    <td>${f.ground||''}</td>
    <td>${f.flightTime||''}</td>
    <td>${f.landings||''}</td>
    <td class="flt-tags-cell">${flightTags(f)}</td>
    <td><span class="dfl-grade g${f.grade}">${GRADE_SHORT[f.grade]||''}</span></td>
    <td style="max-width:130px;font-size:.75rem;color:var(--text-muted)">${f.notes||''}</td>
    <td class="fl-row-actions">
      <button class="fl-edit-btn" data-idx="${i}" title="Edit entry">✎</button>
      <button class="fl-del-btn"  data-idx="${i}" title="Delete entry">✕</button>
    </td>
  </tr>`).join('');
  tbody.querySelectorAll('.fl-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this log entry?')) return;
      const arr = getFlights(); arr.splice(parseInt(btn.dataset.idx),1); saveFlights(arr);
      renderFlightLog(); renderDashboard();
    });
  });
  tbody.querySelectorAll('.fl-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
      openFlightModal(null, null, parseInt(btn.dataset.idx), arr);
    });
  });
  const totalTime = flights.reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const totalDual = flights.filter(f=>f.dual).reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const totalSolo = flights.filter(f=>f.solo).reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const sumEl = document.getElementById('fl-summary');
  if (sumEl) sumEl.textContent =
    `${flights.length} entries · ${totalTime.toFixed(1)} hrs total · ${totalDual.toFixed(1)} dual · ${totalSolo.toFixed(1)} solo`;
}

// ── §61.109 Hour Requirements Calculator ───────────────────────
const FAR_REQS = [
  { key:'total',    label:'Total Flight Time',           req:40,  unit:'hr',      fn: f => parseFloat(f.flightTime||0) },
  { key:'dual',     label:'Dual Instruction',            req:20,  unit:'hr',      fn: f => f.dual  ? parseFloat(f.flightTime||0) : 0 },
  { key:'solo',     label:'Solo Flight Time',            req:10,  unit:'hr',      fn: f => f.solo  ? parseFloat(f.flightTime||0) : 0 },
  { key:'xc_dual',  label:'Cross-Country (Dual)',        req:3,   unit:'hr',      fn: f => (f.dual && f.xc) ? parseFloat(f.flightTime||0) : 0 },
  { key:'night',    label:'Night (Dual)',                req:3,   unit:'hr',      fn: f => (f.dual && f.night) ? parseFloat(f.flightTime||0) : 0 },
  { key:'night_xc', label:'Night XC >50 NM',            req:1,   unit:'flight',  fn: f => (f.dual && f.night && f.xc) ? 1 : 0 },
  { key:'night_tos',label:'Night T&Ls at Towered Arpt', req:10,  unit:'landings',fn: f => (f.night && f.nightTos) ? parseInt(f.landings||0) : 0 },
  { key:'sim',      label:'Instrument Reference (Dual)', req:3,   unit:'hr',      fn: f => (f.dual && f.sim) ? parseFloat(f.flightTime||0) : 0 },
  { key:'solo_xc',  label:'Solo XC >150 NM',            req:1,   unit:'flight',  fn: f => (f.solo && f.xc) ? 1 : 0 },
  { key:'prep',     label:'Pre-checkride Dual (60 days)',req:3,   unit:'hr',      fn: (f, cutoff) => {
    if (!f.dual) return 0;
    if (!cutoff) return 0;
    const d = new Date(f.date); const c = new Date(cutoff);
    return d >= c ? parseFloat(f.flightTime||0) : 0;
  }},
];

function calcHours() {
  const flights = getFlights();
  const cutoff60 = (() => { const d = new Date(); d.setDate(d.getDate()-60); return d.toISOString().split('T')[0]; })();
  const totals = {};
  FAR_REQS.forEach(r => {
    totals[r.key] = flights.reduce((s,f) => s + (r.key==='prep' ? r.fn(f,cutoff60) : r.fn(f)), 0);
  });
  return totals;
}

function renderHoursGrid() {
  const grid = document.getElementById('hours-grid');
  if (!grid) return;
  const totals = calcHours();
  grid.innerHTML = FAR_REQS.map(r => {
    const have = totals[r.key];
    const pct  = Math.min(100, Math.round(have / r.req * 100));
    const met  = have >= r.req;
    const remain = met ? 0 : +(r.req - have).toFixed(1);
    return `<div class="hr-card ${met ? 'met' : (pct>0?'partial':'')}">
      <div class="hr-label">${r.label}</div>
      <div class="hr-bar-wrap"><div class="hr-bar-fill" style="width:${pct}%"></div></div>
      <div class="hr-nums">
        <span class="hr-have">${r.unit==='hr' ? have.toFixed(1) : Math.floor(have)} ${r.unit}</span>
        <span class="hr-req">/ ${r.req} ${r.unit}</span>
        ${met ? '<span class="hr-check">✓</span>' : `<span class="hr-remain">-${r.unit==='hr'?remain.toFixed(1):Math.ceil(remain)}</span>`}
      </div>
    </div>`;
  }).join('');
}

// ── Feature 4: Checkride Readiness ─────────────────────────────
function renderReadiness() {
  const grid = document.getElementById('readiness-grid');
  const badge = document.getElementById('ready-badge');
  if (!grid) return;
  const totals = calcHours();
  const hoursOk = FAR_REQS.every(r => totals[r.key] >= r.req);
  const reqEnds = ['A1','A2','A3','A4','A6','A9','A36','A37'];
  const endsOk  = reqEnds.every(eid => sg(sk('end', eid+'-done')) === '1');
  const signoffs = ALL_LESSON_IDS.filter(sid => getComp(sid) >= 4).length;
  const lessonsOk = signoffs >= Math.floor(ALL_LESSON_IDS.length * 0.8);
  const ktest = getKtest();
  const kTestOk = !!(ktest.date && ktest.score >= 70);
  const miles = getMilestones();
  const milesOk = MILESTONES.every(m => { const d = miles[m.key]||{}; return d.date && d.passed !== false; });
  const checks = [
    { label:'§61.109 Hour Requirements',    ok: hoursOk,   hint: hoursOk ? 'All met' : 'See hour tracker below' },
    { label:'Key Endorsements (AC 61-65K)', ok: endsOk,    hint: endsOk ? 'Required endorsements complete' : 'Open Endorsements tab' },
    { label:'Lessons ≥80% Signed Off',     ok: lessonsOk, hint: `${signoffs}/${ALL_LESSON_IDS.length} signed off` },
    { label:'Knowledge Test Passed (PAR)',   ok: kTestOk,   hint: kTestOk ? `${ktest.score}% on ${ktest.date}` : 'Record test above' },
    { label:'Training Milestones Complete',  ok: milesOk,   hint: milesOk ? 'All milestones passed' : 'Record milestones above' },
  ];
  const totalOk = checks.filter(c=>c.ok).length;
  const allOk   = totalOk === checks.length;
  if (badge) {
    badge.textContent = allOk ? '\u2713 Ready' : `${totalOk}/${checks.length}`;
    badge.className = 'ready-badge ' + (allOk ? 'green' : totalOk >= 3 ? 'amber' : 'red');
  }
  grid.innerHTML = checks.map(c => `
    <div class="rd-item ${c.ok?'ok':'pending'}">
      <span class="rd-icon">${c.ok?'\u2713':'\u25cb'}</span>
      <div>
        <div class="rd-label">${c.label}</div>
        <div class="rd-hint">${c.hint}</div>
      </div>
    </div>`).join('');
}


// ── Feature 6: Solo Currency Tracker ───────────────────────────
function checkSoloCurrency() {
  const banner = document.getElementById('solo-currency-banner');
  if (!banner) return;
  // Solo endorsement date stored in end tracker (A6 = first 90-day solo)
  const a6date = sg(sk('end','A6-date'));
  const a7date = sg(sk('end','A7-date'));
  const latestSolo = [a6date, a7date].filter(Boolean).sort().pop();
  if (!latestSolo) { banner.style.display='none'; return; }
  const exp = new Date(latestSolo);
  exp.setDate(exp.getDate() + 90);
  const now = new Date();
  const daysLeft = Math.ceil((exp - now) / 86400000);
  if (daysLeft > 14) { banner.style.display='none'; return; }
  banner.style.display = '';
  if (daysLeft <= 0) {
    banner.className = 'solo-banner expired';
    banner.innerHTML = `⚠ <strong>Solo endorsement EXPIRED</strong> (A.6/A.7) — student cannot fly solo until re-endorsed. <a href="#endorsements" data-view="endorsements" class="solo-banner-link">Open Endorsements →</a>`;
  } else {
    banner.className = 'solo-banner warning';
    banner.innerHTML = `⚠ <strong>Solo endorsement expires in ${daysLeft} day${daysLeft===1?'':'s'}</strong> — re-endorse before next solo flight. <a href="#endorsements" data-view="endorsements" class="solo-banner-link">Open Endorsements →</a>`;
  }
  banner.querySelector('.solo-banner-link')?.addEventListener('click', e => {
    e.preventDefault(); switchView('endorsements');
  });
}

// ── Feature 8: Syllabus Timeline ───────────────────────────────
function renderTimeline() {
  const wrap = document.getElementById('timeline-wrap');
  if (!wrap) return;
  const flights = getFlights().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if (!flights.length) { wrap.innerHTML='<div class="timeline-empty">No flights logged yet.</div>'; return; }
  // Group by month
  const byMonth = {};
  flights.forEach(f => {
    const mo = (f.date||'').slice(0,7);
    if (!byMonth[mo]) byMonth[mo] = [];
    byMonth[mo].push(f);
  });
  const months = Object.keys(byMonth).sort();
  const maxPerMonth = Math.max(...months.map(m => byMonth[m].length));
  wrap.innerHTML = `<div class="tl-grid">
    ${months.map(mo => {
      const moFlights = byMonth[mo];
      const hrs = moFlights.reduce((s,f)=>s+parseFloat(f.flightTime||0),0);
      const barH = maxPerMonth ? Math.round(moFlights.length/maxPerMonth*60)+20 : 20;
      const moLabel = new Date(mo+'-15').toLocaleDateString('en-US',{month:'short',year:'2-digit'});
      return `<div class="tl-col" title="${moFlights.length} flight${moFlights.length!==1?'s':''} · ${hrs.toFixed(1)} hrs">
        <div class="tl-bar" style="height:${barH}px">
          <span class="tl-count">${moFlights.length}</span>
        </div>
        <div class="tl-mo">${moLabel}</div>
      </div>`;
    }).join('')}
  </div>
  <div class="tl-legend">
    <span>Bars = flights per month</span>
    <span>Total: ${flights.length} flights · ${flights.reduce((s,f)=>s+parseFloat(f.flightTime||0),0).toFixed(1)} hrs</span>
  </div>`;
}

function renderDashboard() {
  const flights = getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const stu = students.find(s=>s.id===activeId) || students[0];

  const nameEl = document.getElementById('dash-student-name');
  const avatarEl = document.getElementById('dash-avatar');
  const subEl = document.getElementById('dash-student-sub');
  if (nameEl) nameEl.textContent = stu?.name || 'Student';
  if (avatarEl) avatarEl.textContent = (stu?.name||'S')[0].toUpperCase();

  const totalTime = flights.reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const signoffs = ALL_LESSON_IDS.filter(sid => getComp(sid) >= 4).length;
  const lessonsStarted = ALL_LESSON_IDS.filter(sid => getComp(sid) >= 1).length;
  document.getElementById('dstat-flights').textContent = flights.length;
  document.getElementById('dstat-time').textContent = totalTime.toFixed(1);
  document.getElementById('dstat-lessons').textContent = lessonsStarted;
  document.getElementById('dstat-signoffs').textContent = signoffs;
  if (subEl) subEl.textContent = flights.length ? `Last flight: ${flights[0]?.date||''}` : 'No sessions logged yet';

  const cbs = [...document.querySelectorAll('input[type="checkbox"][data-ckey]')];
  const total = cbs.length, done = cbs.filter(c=>c.checked).length;
  const pct = total ? Math.round(done/total*100) : 0;
  const ring = document.getElementById('dash-ring');
  const ringPct = document.getElementById('dash-ring-pct');
  if (ring) { const circ = 2*Math.PI*22; ring.style.strokeDashoffset = circ-(circ*pct/100); }
  if (ringPct) ringPct.textContent = pct+'%';

  // next lesson
  const nextLessonEl = document.getElementById('dash-next-lesson');
  if (nextLessonEl) {
    const next = ALL_LESSONS.find(l => getComp(l.id) < 3);
    if (next) {
      const lv = getComp(next.id);
      nextLessonEl.innerHTML = `<div class="dnl-code">${next.code}</div><div class="dnl-title">${next.title}</div><div class="dnl-comp"><span style="color:${['#9399a8','#3b82f6','#f59e0b','#16a34a','#0f5132'][lv]}">●</span> ${COMP_LABELS[lv]}</div><button class="dnl-btn" data-sid="${next.id}">Open Lesson →</button>`;
      nextLessonEl.querySelector('.dnl-btn').addEventListener('click', () => {
        switchView('lessons');
        setTimeout(() => { document.getElementById(next.id)?.scrollIntoView({behavior:'smooth'}); trackVisit(next.id); }, 60);
      });
    } else {
      nextLessonEl.innerHTML = '<div class="dnl-placeholder">🎉 All lessons proficient!</div>';
    }
  }

  // recent flights (top 3)
  const flListEl = document.getElementById('dash-flight-log-list');
  if (flListEl) {
    if (!flights.length) { flListEl.innerHTML = '<div class="dnl-placeholder">No flights logged yet.</div>'; }
    else {
      flListEl.innerHTML = flights.slice(0,3).map(f =>
        `<div class="dfl-item">
          <div class="dfl-top">
            <span class="dfl-date">${f.date||''}</span>
            <span class="dfl-ac">${f.aircraft||''}</span>
            <span class="flt-tags-cell">${flightTags(f)}</span>
            <span class="dfl-grade g${f.grade}">${GRADE_SHORT[f.grade]||''}</span>
          </div>
          <div class="dfl-lesson">${f.lessonTitle||''}</div>
         </div>`).join('');
    }
  }

  // recently visited
  const rvEl = document.getElementById('dash-recent-visits');
  if (rvEl) {
    const visits = getVisits();
    if (!visits.length) { rvEl.innerHTML = '<div class="dnl-placeholder">No lessons visited yet.</div>'; }
    else {
      rvEl.innerHTML = visits.map(sid => {
        const l = ALL_LESSONS.find(x => x.id===sid); if(!l) return '';
        return `<div class="drl-item" data-sid="${sid}"><span class="drl-code">${l.code}</span><span class="drl-title">${l.title}</span></div>`;
      }).join('');
      rvEl.querySelectorAll('.drl-item').forEach(item => {
        item.addEventListener('click', () => {
          switchView('lessons');
          setTimeout(()=>{ document.getElementById(item.dataset.sid)?.scrollIntoView({behavior:'smooth'}); },60);
        });
      });
    }
  }

  // new panels
  renderHoursGrid();
  renderReadiness();
  checkSoloCurrency();
  renderTimeline();
  renderAcsTrend();
  renderMilestones();
  renderKtest();
  updatePaceIndicator();
}

function updateDashboardStats() { renderDashboard(); }

// ── Flight log modal ───────────────────────────────────────────
const flModal = document.getElementById('modal-flight');
let flModalLessonId = null;
let flEditIdx = null;          // null = new entry, number = editing existing

// Feature 3: populate ACS task list when lesson is selected
function populateAcsTasks(lessonId, savedGrades) {
  const wrap = document.getElementById('fl-acs-grade-wrap');
  const list = document.getElementById('fl-acs-tasks-list');
  if (!wrap || !list) return;
  const lesson = ALL_LESSONS.find(l => l.id === lessonId);
  if (!lesson || !lesson.acsTasks || !lesson.acsTasks.length) { wrap.style.display='none'; return; }
  wrap.style.display = '';
  list.innerHTML = lesson.acsTasks.map(t =>
    `<div class="fl-acs-task">
      <span class="fl-acs-code">${t.code}</span>
      <span class="fl-acs-title">${t.title}</span>
      <div class="fl-acs-btns">
        <button class="fl-acs-btn" data-task="${t.code}" data-val="S">S</button>
        <button class="fl-acs-btn" data-task="${t.code}" data-val="U">U</button>
        <button class="fl-acs-btn na" data-task="${t.code}" data-val="N">N/A</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('.fl-acs-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      list.querySelectorAll(`.fl-acs-btn[data-task="${btn.dataset.task}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  // Restore saved grades if editing
  if (savedGrades) {
    Object.entries(savedGrades).forEach(([task, val]) => {
      const btn = list.querySelector(`.fl-acs-btn[data-task="${task}"][data-val="${val}"]`);
      if (btn) btn.classList.add('selected');
    });
  }
}

document.getElementById('fl-lesson-select')?.addEventListener('change', e => {
  populateAcsTasks(e.target.value, null);
});

// editIdx = index into the sorted-descending array; entry = the full flight object
function openFlightModal(lessonId, lessonTitle, editIdx, sortedFlights) {
  flEditIdx = editIdx != null ? editIdx : null;
  const entry = (editIdx != null && sortedFlights) ? sortedFlights[editIdx] : null;

  // Update modal title and save button to reflect mode
  const head = flModal.querySelector('.modal-head');
  const saveBtn = document.getElementById('fl-save-btn');
  if (head) head.childNodes[0].textContent = entry ? 'Edit Flight Entry ' : 'Log Flight Session ';
  if (saveBtn) saveBtn.textContent = entry ? 'Save Changes' : 'Save Entry';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fl-date').value        = entry ? (entry.date || today) : today;
  document.getElementById('fl-aircraft').value    = entry ? (entry.aircraft || '') : (sg('cfi-aircraft') || '');
  document.getElementById('fl-ground').value      = entry ? (entry.ground || '') : '';
  document.getElementById('fl-flight-time').value = entry ? (entry.flightTime || '') : '';
  document.getElementById('fl-landings').value    = entry ? (entry.landings || '') : '';
  document.getElementById('fl-notes').value       = entry ? (entry.notes || '') : '';

  // Flight type tags
  ['dual','solo','night','xc','sim'].forEach(tag => {
    const el = document.getElementById('fl-' + tag);
    if (el) el.checked = entry ? !!entry[tag] : false;
  });
  const ntEl = document.getElementById('fl-night-tos');
  if (ntEl) ntEl.checked = entry ? !!entry.nightTos : false;

  // Grade buttons
  document.querySelectorAll('.grade-btn').forEach(b => {
    b.classList.toggle('selected', entry ? parseInt(b.dataset.grade) === entry.grade : false);
  });

  // Lesson select
  const sel = document.getElementById('fl-lesson-select');
  const targetLesson = entry ? entry.lessonId : lessonId;
  if (sel && targetLesson) sel.value = targetLesson;
  else if (sel && !entry) sel.value = '';

  // ACS tasks
  if (targetLesson) populateAcsTasks(targetLesson, entry ? entry.acsTasks : null);
  else {
    const wrap = document.getElementById('fl-acs-grade-wrap');
    if (wrap) wrap.style.display = 'none';
  }

  flModal.classList.add('open');
  document.getElementById('fl-date').focus();
}

document.getElementById('fl-add-btn')?.addEventListener('click', () => openFlightModal(null, null, null, null));
document.getElementById('dash-add-flight-btn')?.addEventListener('click', () => openFlightModal(null, null, null, null));
document.querySelectorAll('.log-flight-btn').forEach(btn => {
  btn.addEventListener('click', () => openFlightModal(btn.dataset.sid, btn.dataset.title, null, null));
});
document.querySelectorAll('.grade-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});
flModal.querySelector('.modal-close').addEventListener('click', () => flModal.classList.remove('open'));
flModal.addEventListener('click', e => { if (e.target === flModal) flModal.classList.remove('open'); });

document.getElementById('fl-save-btn').addEventListener('click', () => {
  const date       = document.getElementById('fl-date').value;
  const aircraft   = document.getElementById('fl-aircraft').value.trim();
  const lessonSel  = document.getElementById('fl-lesson-select').value;
  const lesson     = ALL_LESSONS.find(l => l.id === lessonSel);
  const ground     = document.getElementById('fl-ground').value;
  const flightTime = document.getElementById('fl-flight-time').value;
  const landings   = document.getElementById('fl-landings').value;
  const gradeBtn   = document.querySelector('.grade-btn.selected');
  const grade      = gradeBtn ? parseInt(gradeBtn.dataset.grade) : 0;
  const notes      = document.getElementById('fl-notes').value.trim();
  const dual     = document.getElementById('fl-dual')?.checked || false;
  const solo     = document.getElementById('fl-solo')?.checked || false;
  const night    = document.getElementById('fl-night')?.checked || false;
  const xc       = document.getElementById('fl-xc')?.checked || false;
  const sim      = document.getElementById('fl-sim')?.checked || false;
  const nightTos = document.getElementById('fl-night-tos')?.checked || false;
  const acsTasks = {};
  document.querySelectorAll('.fl-acs-btn.selected').forEach(btn => {
    acsTasks[btn.dataset.task] = btn.dataset.val;
  });
  if (!date) { alert('Please enter a date.'); return; }
  ss('cfi-aircraft', aircraft);

  const allFlights = getFlights();                          // unsorted, original order
  const sorted     = [...allFlights].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const updated = { date, aircraft, lessonId: lessonSel,
    lessonTitle: lesson ? lesson.code+' '+lesson.title : lessonSel,
    ground, flightTime, landings, grade, notes,
    dual, solo, night, xc, sim, nightTos, acsTasks };

  if (flEditIdx != null) {
    // Find this entry in the original unsorted array by its id
    const targetId = sorted[flEditIdx]?.id;
    const origIdx  = allFlights.findIndex(f => f.id === targetId);
    if (origIdx >= 0) {
      updated.id = targetId;                                // preserve original id
      allFlights[origIdx] = updated;
    }
    flEditIdx = null;
  } else {
    updated.id = mkId();
    allFlights.push(updated);
  }

  saveFlights(allFlights);
  flModal.classList.remove('open');
  renderFlightLog();
  renderDashboard();
});

// ── Feature 1: Data Backup & Restore ──────────────────────────
document.getElementById('settings-backup-btn')?.addEventListener('click', () => {
  try {
    const data = CFIData.settings.exportAll();
    const stu = students.find(s => s.id === activeId);
    const filename = `cfi-backup-${(stu?.name||'data').replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    // Flash confirmation
    const btn = document.getElementById('btn-backup');
    const orig = btn.textContent; btn.textContent = '✓ Saved';
    setTimeout(() => btn.textContent = orig, 2000);
  } catch(e) { alert('Error reading localStorage: ' + e.message); return; }
});

document.getElementById('settings-restore-btn')?.addEventListener('click', () => {
  document.getElementById('backup-file-input').click();
});
document.getElementById('backup-file-input')?.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const keyCount = Object.keys(data).length;
      if (!confirm(`Restore ${keyCount} items from "${file.name}"?\n\nThis will MERGE with existing data (existing keys will be overwritten). Current data is NOT erased first.\n\nRecommended: export a backup first if you want to preserve current data.`)) return;
      const restored = CFIData.settings.importAll(data);
      alert(`Restored ${restored} items. Reloading…`);
      location.reload();
    } catch(err) { alert('Failed to parse backup file: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset input
});

// ── Feature 12: Settings Popover ───────────────────────────────
(function() {
  const settingsPop = document.getElementById('settings-popover');
  const settingsBtn = document.getElementById('btn-settings');
  if (!settingsPop || !settingsBtn) return;
  function showSettings() {
    settingsPop.style.display = '';
    renderVspeedsPopover && renderVspeedsPopover(); // pre-warm
  }
  function hideSettings() { settingsPop.style.display = 'none'; }
  settingsBtn.addEventListener('click', e => {
    e.stopPropagation();
    settingsPop.style.display === 'none' ? showSettings() : hideSettings();
  });
  document.getElementById('settings-close')?.addEventListener('click', hideSettings);
  document.addEventListener('click', e => {
    if (!settingsPop.contains(e.target) && e.target !== settingsBtn) hideSettings();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideSettings(); });
  // V-speeds button inside settings opens V-speeds popover
  document.getElementById('settings-vspeeds-btn')?.addEventListener('click', () => {
    hideSettings();
    const vp = document.getElementById('vspeeds-popover');
    if (vp) { renderVspeedsPopover(); vp.style.display = ''; }
  });
  // Dark mode button inside settings
  document.getElementById('settings-dark-btn')?.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();

// ── Feature 7: Student Quick-Stats Chip ────────────────────────
function updateStudentStatsChip() {
  const chip = document.getElementById('student-stats-chip');
  if (!chip) return;
  const totalHrs  = getFlights().reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const signoffs  = ALL_LESSON_IDS.filter(id => getComp(id) >= 4).length;
  const ktest     = getKtest();
  const miles     = getMilestones();
  const readyChecks = [
    FAR_REQS.every(r => { const t = calcHours(); return t[r.key] >= r.req; }),
    ['A1','A2','A3','A4','A6','A9','A36','A37'].every(eid => sg(sk('end',eid+'-done'))==='1'),
    signoffs >= Math.floor(ALL_LESSON_IDS.length * 0.8),
    !!(ktest.date && ktest.score >= 70),
    MILESTONES.every(m => { const d=miles[m.key]||{}; return d.date && d.passed!==false; }),
  ];
  const ready = readyChecks.filter(Boolean).length;
  chip.textContent = `${totalHrs.toFixed(1)}h · ${signoffs}✓ · ${ready}/5`;
  chip.title = `${totalHrs.toFixed(1)} hrs logged · ${signoffs}/${ALL_LESSON_IDS.length} lessons signed off · ${ready}/5 readiness checks`;
  chip.style.color = ready === 5 ? 'var(--green)' : ready >= 3 ? '#d97706' : 'var(--text-muted)';
}

// ── Feature 4 (landing tab): Update initFlightTools tab wiring ──
// ── Feature 5: ACS Task Drill-Down ─────────────────────────────
// Patch renderAcsTrend to add clickable rows
const _origRenderAcsTrend = renderAcsTrend;
function renderAcsTrend() {
  _origRenderAcsTrend();
  // Wire drill-down after render
  const container = document.getElementById('acs-trend-wrap');
  if (!container) return;
  container.querySelectorAll('.act-row').forEach(row => {
    if (row.dataset.drillWired) return;
    row.dataset.drillWired = '1';
    row.style.cursor = 'pointer';
    row.title = 'Click to see flight-by-flight history';
    row.addEventListener('click', () => {
      const code = row.querySelector('.act-code')?.textContent?.trim();
      if (!code) return;
      // Toggle expand
      const existing = container.querySelector(`.act-drill[data-for="${code}"]`);
      if (existing) { existing.remove(); return; }
      const flights = getFlights().filter(f => f.acsTasks && f.acsTasks[code])
                                  .sort((a,b) => (b.date||'').localeCompare(a.date||''));
      const drillHtml = `<tr class="act-drill" data-for="${code}">
        <td colspan="8" style="padding:0">
          <div class="act-drill-panel">
            <div class="act-drill-title">Flight history for <strong>${code}</strong></div>
            <table class="act-drill-tbl">
              <thead><tr><th>Date</th><th>Aircraft</th><th>Lesson</th><th>Grade</th></tr></thead>
              <tbody>${flights.map(f => `<tr>
                <td>${f.date||''}</td>
                <td>${f.aircraft||''}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.lessonTitle||''}</td>
                <td><span class="act-drill-grade ${f.acsTasks[code]==='S'?'sat':f.acsTasks[code]==='U'?'unsat':'na'}">${f.acsTasks[code]||'?'}</span></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </td>
      </tr>`;
      row.insertAdjacentHTML('afterend', drillHtml);
    });
  });
}

// ── Feature 10: Weather Go/No-Go Evaluator ─────────────────────
document.getElementById('wx-eval-btn')?.addEventListener('click', () => {
  const ceiling = parseFloat(document.getElementById('wx-ceiling')?.value) || 0;
  const vis     = parseFloat(document.getElementById('wx-vis')?.value)     || 0;
  const wind    = parseFloat(document.getElementById('wx-wind')?.value)    || 0;
  const xwind   = parseFloat(document.getElementById('wx-xwind')?.value)   || 0;
  const da      = parseFloat(document.getElementById('wx-da')?.value)      || 0;
  const ftype   = document.getElementById('wx-ftype')?.value || 'local';
  const ts      = document.getElementById('wx-ts')?.checked;
  const icing   = document.getElementById('wx-icing')?.checked;
  const tfr     = document.getElementById('wx-tfr')?.checked;
  const notam   = document.getElementById('wx-notam')?.checked;
  const turb    = document.getElementById('wx-turb')?.checked;
  const wshear  = document.getElementById('wx-wshear')?.checked;

  // Load student personal minimums
  const mins = getMins();
  const pMinCeiling = parseFloat(mins.ceiling) || null;
  const pMinVis     = parseFloat(mins.vis)     || null;
  const pMaxXwind   = parseFloat(mins.xwind)   || null;

  // Regulatory minimums (§91.155, Class E / VFR local)
  const regs = {
    ceiling: ftype === 'xc' ? 1000 : 500,   // pattern vs XC practical minimums
    vis:     ftype === 'xc' ? 3    : 1,
    xwind:   17,  // PA-28-140 demonstrated XC component
  };

  const checks = [];
  const add = (label, ok, detail, reg) =>
    checks.push({ label, ok, detail, reg });

  // Ceiling
  if (ceiling > 0) {
    const regOk  = ceiling >= regs.ceiling;
    const perOk  = pMinCeiling ? ceiling >= pMinCeiling : true;
    add('Ceiling', regOk && perOk,
      `${ceiling.toLocaleString()} ft AGL`,
      `Regulatory: ≥${regs.ceiling} ft · Personal min: ${pMinCeiling ? pMinCeiling + ' ft' : 'not set'}`);
  }

  // Visibility
  if (vis > 0) {
    const regOk  = vis >= regs.vis;
    const perOk  = pMinVis ? vis >= pMinVis : true;
    add('Visibility', regOk && perOk,
      `${vis} SM`,
      `Regulatory: ≥${regs.vis} SM · Personal min: ${pMinVis ? pMinVis + ' SM' : 'not set'}`);
  }

  // Crosswind
  if (xwind > 0) {
    const poaOk = xwind <= regs.xwind;
    const perOk = pMaxXwind ? xwind <= pMaxXwind : true;
    add('Crosswind Component', poaOk && perOk,
      `${xwind} kts`,
      `POH demonstrated: ≤${regs.xwind} kts · Personal max: ${pMaxXwind ? pMaxXwind + ' kts' : 'not set'}`);
  }

  // Density Altitude
  if (da !== 0) {
    const daOk = da < 6000;
    add('Density Altitude', daOk,
      `${da.toLocaleString()} ft`,
      da < 3000 ? 'Minimal performance impact' :
      da < 6000 ? 'Moderate impact — verify W&B and takeoff distances' :
                  'High DA — significant performance degradation, verify carefully');
  }

  // Hazards
  if (ts)     add('Thunderstorms', false, 'Within 20 NM', 'VFR flight into IMC risk — NO GO');
  if (icing)  add('Icing conditions', false, 'PIREP / forecast', 'Cherokee 140 is not certified for known icing');
  if (tfr)    add('TFR on route', false, 'Active TFR', 'Check notams.faa.gov for exact boundaries');
  if (turb)   add('Turbulence', false, 'Moderate+ forecast', 'Exceeds student proficiency threshold');
  if (wshear) add('Wind shear', false, 'Reported', 'Avoid approach/departure until resolved');
  if (notam)  add('NOTAMs', null, 'Review required', 'Check for runway closures, equipment outages');

  const goChecks  = checks.filter(c => c.ok === false);
  const allGo     = checks.filter(c => c.ok !== null).every(c => c.ok);
  const verdict   = ts || icing ? 'NO GO' : allGo ? 'GO' : goChecks.length <= 1 ? 'CAUTION' : 'NO GO';
  const vColor    = verdict === 'GO' ? '#15803d' : verdict === 'CAUTION' ? '#d97706' : '#b91c1c';

  const checkHtml = checks.map(c => `
    <div class="gono-check ${c.ok===true?'ok':c.ok===false?'fail':'warn'}">
      <span class="gono-check-icon">${c.ok===true?'✓':c.ok===false?'✗':'?'}</span>
      <div>
        <div class="gono-check-label">${c.label}: <strong>${c.detail}</strong></div>
        <div class="gono-check-hint">${c.reg||''}</div>
      </div>
    </div>`).join('');

  document.getElementById('gono-results').innerHTML = `
    <div class="gono-verdict" style="border-color:${vColor};color:${vColor}">${verdict}</div>
    <div class="gono-checks">${checkHtml}</div>
    ${!pMinCeiling&&!pMinVis&&!pMaxXwind?'<div class="gono-tip">💡 Set personal minimums in the student profile to include them in this evaluation.</div>':''}
    <div class="gono-disclaimer">This is a training aid only. Always obtain a standard weather briefing from 1800wxbrief.com or Flight Service before flight.</div>`;
});

// ── Feature 11: Pre-Solo Knowledge Quiz ────────────────────────


let quizState = null;

function initPreSoloQuiz() {
  const stu = students.find(s => s.id === activeId);
  const nameEl = document.getElementById('quiz-student-name');
  if (nameEl) nameEl.textContent = stu?.name ? ` — ${stu.name}` : '';

  // Load saved state
  try { quizState = JSON.parse(sg(sk('misc','presolo-quiz')) || 'null'); } catch { quizState = null; }

  renderQuiz();

  document.getElementById('quiz-start-btn')?.addEventListener('click', startQuiz);
  document.getElementById('quiz-reset-btn')?.addEventListener('click', resetQuiz);
}

function startQuiz() {
  quizState = { answers: {}, started: new Date().toISOString(), done: false };
  ss(sk('misc','presolo-quiz'), JSON.stringify(quizState));
  document.getElementById('quiz-start-btn').style.display = 'none';
  document.getElementById('quiz-reset-btn').style.display = '';
  renderQuizQuestions();
}

function resetQuiz() {
  if (!confirm('Reset quiz? All answers will be cleared.')) return;
  quizState = null;
  ss(sk('misc','presolo-quiz'), 'null');
  document.getElementById('quiz-start-btn').style.display = '';
  document.getElementById('quiz-reset-btn').style.display = 'none';
  document.getElementById('quiz-score-display').style.display = 'none';
  renderQuiz();
}

function renderQuiz() {
  if (!quizState || !quizState.started) {
    document.getElementById('quiz-container').innerHTML =
      '<div class="quiz-placeholder">Press Start Quiz to begin the §61.87(b) pre-solo knowledge test.</div>';
    document.getElementById('quiz-start-btn').style.display = '';
    document.getElementById('quiz-reset-btn').style.display = 'none';
    document.getElementById('quiz-score-display').style.display = 'none';
    document.getElementById('quiz-status-bar').style.display = 'none';
    return;
  }
  document.getElementById('quiz-start-btn').style.display = 'none';
  document.getElementById('quiz-reset-btn').style.display = '';
  renderQuizQuestions();
}

function renderQuizQuestions() {
  const container = document.getElementById('quiz-container');
  const answered  = Object.keys(quizState?.answers||{}).length;
  const total     = QUIZ_QUESTIONS.length;
  const statusBar = document.getElementById('quiz-status-bar');
  if (statusBar) {
    statusBar.style.display = '';
    statusBar.textContent = `${answered} / ${total} answered`;
  }
  container.innerHTML = QUIZ_QUESTIONS.map((q, qi) => {
    const saved = quizState?.answers?.[qi];
    const done  = quizState?.done;
    return `<div class="quiz-q ${done&&saved!=null?(saved===q.a?'quiz-correct':'quiz-wrong'):''}">
      <div class="quiz-q-num">Q${qi+1} <span class="quiz-q-ref">${q.ref}</span></div>
      <div class="quiz-q-text">${q.q}</div>
      <div class="quiz-opts">
        ${q.opts.map((opt,oi) => `<label class="quiz-opt ${done?(oi===q.a?'quiz-opt-correct':(oi===saved&&saved!==q.a?'quiz-opt-wrong':'')):''}">
          <input type="radio" name="q${qi}" value="${oi}" ${saved===oi?'checked':''} ${done?'disabled':''}>
          ${opt}
        </label>`).join('')}
      </div>
      ${done&&saved!==q.a?`<div class="quiz-explain">✓ Correct: <strong>${q.opts[q.a]}</strong></div>`:''}
    </div>`;
  }).join('');

  if (!quizState?.done) {
    // Wire radio inputs
    container.querySelectorAll('input[type=radio]').forEach(inp => {
      inp.addEventListener('change', () => {
        const qi = parseInt(inp.name.replace('q',''));
        quizState.answers[qi] = parseInt(inp.value);
        ss(sk('misc','presolo-quiz'), JSON.stringify(quizState));
        const answered = Object.keys(quizState.answers).length;
        if (statusBar) statusBar.textContent = `${answered} / ${QUIZ_QUESTIONS.length} answered`;
        if (answered === QUIZ_QUESTIONS.length) submitQuiz();
      });
    });
  } else {
    showQuizScore();
  }
}

function submitQuiz() {
  quizState.done = true;
  quizState.completed = new Date().toISOString();
  ss(sk('misc','presolo-quiz'), JSON.stringify(quizState));
  renderQuizQuestions();
  showQuizScore();
}

function showQuizScore() {
  const correct = QUIZ_QUESTIONS.filter((q,i) => quizState.answers[i] === q.a).length;
  const pct = Math.round(correct / QUIZ_QUESTIONS.length * 100);
  const pass = pct >= 80;
  const scoreEl = document.getElementById('quiz-score-display');
  if (scoreEl) {
    scoreEl.style.display = '';
    scoreEl.innerHTML = `<span class="quiz-score-val ${pass?'pass':'fail'}">${pct}%</span>
      <span class="quiz-score-label">${correct}/${QUIZ_QUESTIONS.length} correct — ${pass?'✓ Passed':'✗ Review needed'}</span>
      ${pass?'<span class="quiz-score-note">CFI may now sign off endorsement A.1 (pre-solo aeronautical knowledge).</span>':''}`;
  }
}

(function() {
  let activeFilters = { from: '', to: '', lesson: '', tags: new Set() };

  function applyFlightFilter() {
    const rows = document.querySelectorAll('#fl-tbody tr');
    const flights = getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    let shown = 0;
    rows.forEach((row, i) => {
      const f = flights[i];
      if (!f) { row.style.display = 'none'; return; }
      let show = true;
      if (activeFilters.from && f.date < activeFilters.from) show = false;
      if (activeFilters.to   && f.date > activeFilters.to)   show = false;
      if (activeFilters.lesson) {
        const q = activeFilters.lesson.toLowerCase();
        if (!(f.lessonTitle||'').toLowerCase().includes(q)) show = false;
      }
      activeFilters.tags.forEach(tag => {
        if (tag === 'dual'  && !f.dual)  show = false;
        if (tag === 'solo'  && !f.solo)  show = false;
        if (tag === 'night' && !f.night) show = false;
        if (tag === 'xc'    && !f.xc)    show = false;
        if (tag === 'sim'   && !f.sim)   show = false;
      });
      row.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    const countEl = document.getElementById('fl-filt-count');
    const total = flights.length;
    if (countEl) countEl.textContent = (shown < total) ? `${shown} of ${total}` : '';
    const empty = document.getElementById('fl-empty');
    if (empty) empty.classList.toggle('show', shown === 0 && total > 0);
  }

  function initFlightFilter() {
    const fromEl   = document.getElementById('fl-filt-from');
    const toEl     = document.getElementById('fl-filt-to');
    const lessonEl = document.getElementById('fl-filt-lesson');
    const clearBtn = document.getElementById('fl-filt-clear');
    if (!fromEl) return;
    fromEl.addEventListener('input',   () => { activeFilters.from = fromEl.value; applyFlightFilter(); });
    toEl.addEventListener('input',     () => { activeFilters.to   = toEl.value;   applyFlightFilter(); });
    lessonEl.addEventListener('input', () => { activeFilters.lesson = lessonEl.value.trim(); applyFlightFilter(); });
    document.querySelectorAll('.fl-ftag').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.ft;
        if (activeFilters.tags.has(t)) { activeFilters.tags.delete(t); btn.classList.remove('active'); }
        else { activeFilters.tags.add(t); btn.classList.add('active'); }
        applyFlightFilter();
      });
    });
    clearBtn?.addEventListener('click', () => {
      activeFilters = { from: '', to: '', lesson: '', tags: new Set() };
      fromEl.value = ''; toEl.value = ''; lessonEl.value = '';
      document.querySelectorAll('.fl-ftag').forEach(b => b.classList.remove('active'));
      applyFlightFilter();
    });
  }

  // Re-apply filter after table re-renders; hook into renderFlightLog
  const _origRFL = renderFlightLog;
  window.renderFlightLog = function() {
    _origRFL();
    applyFlightFilter();
  };

  // Wire once DOM ready
  document.addEventListener('DOMContentLoaded', initFlightFilter);
  // Also wire when flightlog view becomes active (already rendered)
  document.getElementById('nav-flightlog')?.addEventListener('click', () => {
    setTimeout(initFlightFilter, 50);
  });
  initFlightFilter();
})();

// ── Feature 5: Session History Feed ────────────────────────────
function renderSessionHistory() {
  const feed    = document.getElementById('sh-feed');
  const countEl = document.getElementById('sh-count');
  if (!feed) return;

  // Collect all lessons that have any notes
  const entries = [];
  ALL_LESSONS.forEach(l => {
    const instr = sg(sk('note', l.id + '-instr')) || '';
    const stud  = sg(sk('note', l.id + '-stud'))  || '';
    if (!instr && !stud) return;
    // Try to find the most recent flight date for this lesson
    const flights = getFlights().filter(f => f.lessonId === l.id)
                                .sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const date = flights[0]?.date || '';
    entries.push({ lessonId: l.id, code: l.code, title: l.title, instr, stud, date });
  });

  // Sort: entries with dates by date desc, then undated alphabetically
  entries.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.code.localeCompare(b.code);
  });

  // Apply search + type filter
  const q     = (document.getElementById('sh-search')?.value || '').toLowerCase();
  const type  = document.querySelector('.sh-type.active')?.dataset.shtype || 'all';

  const filtered = entries.filter(e => {
    const matchType = type === 'all' || (type === 'instr' && e.instr) || (type === 'stud' && e.stud);
    const matchQ    = !q || e.instr.toLowerCase().includes(q) || e.stud.toLowerCase().includes(q)
                         || e.title.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
    return matchType && matchQ;
  });

  if (countEl) countEl.textContent = `${filtered.length} lesson${filtered.length !== 1 ? 's' : ''} with notes`;

  if (!filtered.length) {
    feed.innerHTML = `<div class="sh-empty">${q ? 'No notes match your search.' : 'No session notes recorded yet.'}</div>`;
    return;
  }

  feed.innerHTML = filtered.map(e => {
    const escInstr = e.instr.replace(/</g,'&lt;').replace(/\n/g,'<br>');
    const escStud  = e.stud.replace(/</g,'&lt;').replace(/\n/g,'<br>');
    return `<div class="sh-entry" data-sid="${e.lessonId}">
      <div class="sh-entry-head">
        <span class="sh-entry-code">${e.code}</span>
        <span class="sh-entry-title">${e.title}</span>
        ${e.date ? `<span class="sh-entry-date">${e.date}</span>` : ''}
        <button class="sh-goto-btn" data-sid="${e.lessonId}" title="Open lesson">→ Open</button>
      </div>
      ${e.instr && (type === 'all' || type === 'instr') ? `
        <div class="sh-note-block sh-instr">
          <span class="sh-note-label">Instructor</span>
          <div class="sh-note-text">${escInstr}</div>
        </div>` : ''}
      ${e.stud && (type === 'all' || type === 'stud') ? `
        <div class="sh-note-block sh-stud">
          <span class="sh-note-label">Student</span>
          <div class="sh-note-text">${escStud}</div>
        </div>` : ''}
    </div>`;
  }).join('');

  // Wire goto buttons
  feed.querySelectorAll('.sh-goto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView('lessons');
      setTimeout(() => {
        document.getElementById(btn.dataset.sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });
  });
}

// Wire session history search + type filter
document.getElementById('sh-search')?.addEventListener('input', renderSessionHistory);
document.querySelectorAll('.sh-type').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sh-type').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSessionHistory();
  });
});

// ── Feature 10: Ground Lesson Print Card ───────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.lesson-print-btn');
  if (!btn) return;
  const sid = btn.dataset.sid;
  const section = document.querySelector(`.lesson-section[data-lesson-id="${sid}"]`);
  if (!section) return;

  const code  = section.querySelector('.lesson-code')?.textContent || '';
  const title = section.querySelector('.lesson-title')?.textContent || '';
  const refsEl = section.querySelector('.lb-refs-text');
  const refs   = refsEl ? refsEl.innerHTML : '';

  // Pull meta table rows
  const metaRows = {};
  section.querySelectorAll('.lb-table tr').forEach(tr => {
    const th = tr.querySelector('th')?.textContent?.trim();
    const td = tr.querySelector('td')?.innerHTML || '';
    if (th) metaRows[th] = td;
  });

  // Pull ACS block
  const acsBlock  = section.querySelector('.lesson-acs');
  const taskHtml  = acsBlock?.querySelector('.acs-tasks')?.outerHTML || '';
  const riskHtml  = acsBlock?.querySelector('.acs-risk ul')?.outerHTML || '';
  const debHtml   = acsBlock?.querySelector('.acs-debrief ul')?.outerHTML || '';

  // Pull lesson body text (clean)
  const bodyEl = section.querySelector('.lesson-body');
  const bodyHtml = bodyEl ? bodyEl.innerHTML : '';

  // Pull notes
  const instrNote = sg(sk('note', sid + '-instr')) || '';
  const studNote  = sg(sk('note', sid + '-stud'))  || '';

  const stu = students.find(s => s.id === activeId);

  const section_block = (label, html) => html
    ? `<div class="pc-section"><h3 class="pc-sec-label">${label}</h3>${html}</div>` : '';

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="en"><head>
<title>${code} ${title} — Ground Lesson</title><meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; font-size: 11pt; padding: 28px 36px; max-width: 780px; margin: 0 auto; color: #111; }
  h1 { font-size: 16pt; margin: 0 0 4px; color: #0d1e38; }
  .pc-header { border-bottom: 2px solid #0d1e38; padding-bottom: 10px; margin-bottom: 16px; }
  .pc-meta { font-size: 9pt; color: #666; margin-top: 3px; }
  .pc-refs { font-size: 9pt; background: #f7f4ef; border-left: 3px solid #b8871f; padding: 6px 10px; margin-bottom: 14px; border-radius: 2px; }
  h3.pc-sec-label { font-family: Arial, sans-serif; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #0d1e38; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 16px 0 6px; }
  .pc-section { margin-bottom: 10px; }
  ol, ul { margin: 4px 0; padding-left: 20px; }
  li { margin-bottom: 3px; font-size: 10.5pt; }
  p { margin: 4px 0 6px; font-size: 10.5pt; line-height: 1.55; }
  .acs-tasks { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .acs-tasks li { background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 2px 6px; font-size: 8.5pt; }
  .acs-code { font-weight: 700; margin-right: 4px; color: #0d1e38; }
  .note-block { background: #fffbf0; border: 1px solid #e8d9a0; border-radius: 3px; padding: 8px 12px; margin-top: 6px; font-size: 9.5pt; white-space: pre-wrap; }
  .note-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #888; display: block; margin-bottom: 3px; }
  @media print { button { display: none !important; } body { padding: 14px 20px; } }
</style>
</head><body>
<div class="pc-header">
  <h1>${code ? code + ' · ' : ''}${title}</h1>
  <div class="pc-meta">Student: ${stu?.name || '—'} · Generated ${new Date().toLocaleDateString()} · CFI Lesson Plans</div>
</div>
${refs ? `<div class="pc-refs"><strong>References:</strong> ${refs}</div>` : ''}
${section_block('Objective', metaRows['Objectives'] || metaRows['Objective'])}
${section_block('Key Elements', metaRows['Key Elements'])}
${section_block('Elements', metaRows['Elements'])}
${taskHtml ? section_block('ACS Tasks', taskHtml) : ''}
${riskHtml ? section_block('Risk Management', `<ul>${riskHtml}</ul>`) : ''}
${section_block('Schedule', metaRows['Schedule'])}
${section_block('Equipment', metaRows['Equipment'])}
${section_block('Completion Standards', metaRows['Completion Standards'])}
${debHtml ? section_block('Debrief Prompts', `<ul>${debHtml}</ul>`) : ''}
${bodyHtml ? section_block('Lesson Content', bodyHtml) : ''}
${instrNote ? `<div class="note-block"><span class="note-label">Instructor Notes</span>${instrNote.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}
${studNote ? `<div class="note-block"><span class="note-label">Student Notes</span>${studNote.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}
<br><button onclick="window.print()" style="padding:7px 18px;background:#0d1e38;color:white;border:none;border-radius:4px;cursor:pointer">Print / Save PDF</button>
</body></html>`);
  win.document.close();
});

// ── Feature 11: Progress Pace Indicator ────────────────────────
function updatePaceIndicator() {
  const paceEl = document.getElementById('dstat-pace');
  if (!paceEl) return;
  const stu = students.find(s => s.id === activeId);
  const startDate = stu?.start;
  if (!startDate) { paceEl.textContent = '—'; paceEl.title = 'Set training start date in student profile'; return; }

  const flights = getFlights();
  const totalHrs = flights.reduce((s, f) => s + parseFloat(f.flightTime||0), 0);
  const signoffs = ALL_LESSON_IDS.filter(id => getComp(id) >= 4).length;

  const startMs  = new Date(startDate).getTime();
  const nowMs    = Date.now();
  const weeksIn  = (nowMs - startMs) / (7 * 24 * 3600 * 1000);
  if (weeksIn <= 0) { paceEl.textContent = '—'; return; }

  // Expected pace: median PPL = ~65 hrs over ~6 months (26 weeks)
  const expectedHrsNow  = (65 / 26) * weeksIn;
  const hrsRatio   = totalHrs / Math.max(1, expectedHrsNow);

  // Lesson pace: all 79 lessons in ~26 weeks
  const expectedLessonsNow = (ALL_LESSON_IDS.length / 26) * weeksIn;
  const lessonRatio = signoffs / Math.max(1, expectedLessonsNow);

  const ratio = (hrsRatio + lessonRatio) / 2;

  let label, color;
  if (ratio >= 1.15)      { label = '⬆ Ahead';   color = 'var(--green)'; }
  else if (ratio >= 0.85) { label = '✓ On pace';  color = 'var(--green)'; }
  else if (ratio >= 0.60) { label = '⚑ Slightly behind'; color = '#d97706'; }
  else                    { label = '⬇ Behind';   color = '#dc2626'; }

  paceEl.textContent = label;
  paceEl.style.color = color;
  paceEl.style.fontSize = '.72rem';
  paceEl.title = `${totalHrs.toFixed(1)} hrs logged · ${signoffs} lessons signed off · ${weeksIn.toFixed(0)} weeks training`;
}

// ── Feature 11 (W&B): Save last-used values ────────────────────
(function() {
  const WB_INPUTS = ['wb-empty-wt','wb-empty-arm','wb-front-wt','wb-rear-wt','wb-bag-wt','wb-fuel-gal'];

  function saveWBLast() {
    const vals = {};
    WB_INPUTS.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value) vals[id] = el.value;
    });
    CFIData.settings.setWbLast(vals);
  }

  function loadWBLast() {
    try {
      const saved = CFIData.settings.getWbLast();
      WB_INPUTS.forEach(id => {
        const el = document.getElementById(id);
        if (el && saved[id] != null) el.value = saved[id];
      });
    } catch {}
  }

  // Hook: save on any W&B input change (after calcWB fires)
  const origInitTools = initFlightTools;
  window.initFlightTools = function() {
    origInitTools();
    loadWBLast();
    document.querySelectorAll('.wb-inp').forEach(el => {
      el.addEventListener('change', saveWBLast);
    });
  };
})();

// ── Feature 2: Training Milestones ─────────────────────────────
const MILESTONES = [
  { key: 'first-solo',    label: 'First Solo',             icon: '✈',  needsExaminer: false },
  { key: 'presolo-stage', label: 'Pre-Solo Stage Check',   icon: '📋', needsExaminer: true  },
  { key: 'prexc-stage',   label: 'Pre-XC Stage Check',     icon: '🗺', needsExaminer: true  },
  { key: 'mock-oral',     label: 'Mock Oral Exam',         icon: '🎓', needsExaminer: true  },
  { key: 'mock-checkride',label: 'Mock Checkride',         icon: '🎯', needsExaminer: true  },
];




function renderMilestones() {
  const grid = document.getElementById('milestones-grid');
  if (!grid) return;
  const data = getMilestones();
  grid.innerHTML = MILESTONES.map(m => {
    const d = data[m.key] || {};
    const done = !!(d.date && d.passed !== false);
    const passed = d.passed !== false;
    return `<div class="ms-card ${done ? (passed ? 'ms-pass' : 'ms-fail') : 'ms-pending'}" data-ms="${m.key}">
      <div class="ms-icon">${m.icon}</div>
      <div class="ms-info">
        <div class="ms-label">${m.label}</div>
        ${d.date ? `<div class="ms-date">${d.date}${d.examiner ? ' · ' + d.examiner : ''}</div>` : '<div class="ms-date ms-unset">Not recorded</div>'}
        ${d.passed === false ? '<div class="ms-result fail">Not Passed</div>' : d.date ? '<div class="ms-result pass">Passed</div>' : ''}
      </div>
      <button class="ms-edit-btn" data-ms="${m.key}" title="Edit">✎</button>
    </div>`;
  }).join('');
  grid.querySelectorAll('.ms-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openMilestoneEditor(btn.dataset.ms));
  });
}

let msEditorTarget = null;
function openMilestoneEditor(key) {
  msEditorTarget = key;
  const m = MILESTONES.find(x => x.key === key);
  const data = getMilestones();
  const d = data[key] || {};
  const modal = document.getElementById('modal-milestone');
  if (!modal) return;
  modal.querySelector('.ms-modal-title').textContent = m.label;
  document.getElementById('ms-date-inp').value    = d.date || '';
  document.getElementById('ms-passed-inp').value  = d.passed === false ? '0' : '1';
  document.getElementById('ms-examiner-inp').value= d.examiner || '';
  document.getElementById('ms-conditions-inp').value= d.conditions || '';
  modal.classList.add('open');
}
document.getElementById('ms-save-btn')?.addEventListener('click', () => {
  if (!msEditorTarget) return;
  const data = getMilestones();
  data[msEditorTarget] = {
    date:       document.getElementById('ms-date-inp').value,
    passed:     document.getElementById('ms-passed-inp').value !== '0',
    examiner:   document.getElementById('ms-examiner-inp').value.trim(),
    conditions: document.getElementById('ms-conditions-inp').value.trim(),
  };
  saveMilestones(data);
  document.getElementById('modal-milestone').classList.remove('open');
  renderMilestones();
  renderReadiness();
});
document.getElementById('ms-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('modal-milestone').classList.remove('open');
});
document.getElementById('modal-milestone')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modal-milestone'))
    document.getElementById('modal-milestone').classList.remove('open');
});
document.querySelector('#modal-milestone .modal-close')?.addEventListener('click', () => {
  document.getElementById('modal-milestone').classList.remove('open');
});

// ── Feature 3: Knowledge Test Tracker ──────────────────────────
const PAR_SUBJECTS = [
  'Pilot Qualifications', 'Airspace Classification & Operating Requirements',
  'Flight Instruments', 'Aviation Weather / Services',
  'Performance & Limitations', 'Navigation & Charts',
  'FAR / AIM Regulations', 'Radio Communications & ATC Procedures',
  'Emergency Procedures', 'Aerodynamics & Aircraft Systems',
];




function renderKtest() {
  const layout = document.getElementById('ktest-layout');
  if (!layout) return;
  const d = getKtest();
  const passed = d.date && d.score >= 70;
  layout.innerHTML = `
    <div class="kt-summary ${passed ? 'kt-pass' : d.date ? 'kt-fail' : ''}">
      <div class="kt-fields">
        <div class="kt-field">
          <label class="kt-label">Test Date</label>
          <input type="date" class="kt-inp" id="kt-date" value="${d.date||''}">
        </div>
        <div class="kt-field">
          <label class="kt-label">Score (%)</label>
          <input type="number" class="kt-inp" id="kt-score" min="0" max="100"
            value="${d.score||''}" placeholder="e.g. 84">
        </div>
        <div class="kt-field">
          <label class="kt-label">Status</label>
          <div class="kt-status ${passed?'pass':d.date?'fail':''}">
            ${passed ? '✓ Passed' : d.date ? `✗ ${d.score < 70 ? 'Below 70% — retest required' : 'Score needed'}` : 'Not yet taken'}
          </div>
        </div>
        <button class="modal-btn primary kt-save-btn" id="kt-save-btn" style="align-self:flex-end">Save</button>
      </div>
      ${passed ? '<div class="kt-pass-note">Knowledge test complete. Endorsement A.2 available in Endorsements tab.</div>' : ''}
    </div>
    <div class="kt-deficiencies">
      <div class="kt-def-label">Subject Areas Deficient on AKTR <span class="kt-def-hint">(check all that were marked)</span></div>
      <div class="kt-def-grid">
        ${PAR_SUBJECTS.map((s,i) => `<label class="kt-def-item">
          <input type="checkbox" class="kt-def-cb" data-idx="${i}" ${(d.deficiencies||[]).includes(i)?'checked':''}>
          <span>${s}</span>
        </label>`).join('')}
      </div>
    </div>`;
  document.getElementById('kt-save-btn')?.addEventListener('click', () => {
    const cur = getKtest();
    cur.date  = document.getElementById('kt-date')?.value || '';
    cur.score = parseInt(document.getElementById('kt-score')?.value) || 0;
    cur.deficiencies = [...document.querySelectorAll('.kt-def-cb:checked')].map(cb => parseInt(cb.dataset.idx));
    saveKtest(cur);
    // Also update the legacy ktest-done flag for readiness panel
    if (cur.date && cur.score >= 70) ss(sk('misc','ktest-done'), '1');
    else ss(sk('misc','ktest-done'), '0');
    renderKtest();
    renderReadiness();
  });
}

// ── Feature 5 (enhanced): Rich Print / Export Student Record ────
document.getElementById('fl-export-btn')?.addEventListener('click', () => {
  const stu   = students.find(s => s.id === activeId) || {};
  const flights = getFlights().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const totals  = calcHours();
  const ktest   = getKtest();
  const miles   = getMilestones();
  const mins    = getMins();
  const win = window.open('','_blank');

  // §61.109 hours rows
  const hrRows = FAR_REQS.map(r => {
    const have = totals[r.key], met = have >= r.req;
    return `<tr style="color:${met?'#166534':'#7f1d1d'}">
      <td>${r.label}</td>
      <td>${r.unit==='hr'?have.toFixed(1):Math.floor(have)} ${r.unit}</td>
      <td>${r.req} ${r.unit}</td>
      <td>${met?'✓ Met':'Need '+(r.unit==='hr'?(r.req-have).toFixed(1):Math.ceil(r.req-have))+' more'}</td>
    </tr>`;
  }).join('');

  // Competency ratings by lesson
  const compRows = ALL_LESSONS.map(l => {
    const lv = getComp(l.id);
    const labels = ['Not Started','Introduced','Practiced','Proficient','Signed Off'];
    const colors = ['#9399a8','#3b82f6','#f59e0b','#16a34a','#0f5132'];
    return `<tr><td>${l.code}</td><td>${l.title}</td>
      <td style="color:${colors[lv]};font-weight:600">${labels[lv]}</td></tr>`;
  }).join('');

  // Completed endorsements
  const endItems = window.END_DATA_JS
    ? END_DATA_JS.filter(e => sg(sk('end', e.id+'-done'))==='1')
        .map(e => {
          const dt = sg(sk('end', e.id+'-date')) || '';
          return `<tr><td>${e.id}</td><td>${e.label}</td><td>${dt}</td></tr>`;
        }).join('')
    : '<tr><td colspan="3">Endorsement data unavailable</td></tr>';

  // ACS task performance
  const taskStats = {};
  flights.forEach(f => {
    if (!f.acsTasks) return;
    Object.entries(f.acsTasks).forEach(([code, val]) => {
      if (!taskStats[code]) {
        let name = code;
        for (const l of ALL_LESSONS) { const t=(l.acsTasks||[]).find(t=>t.code===code); if(t){name=t.title;break;} }
        taskStats[code] = {name, S:0, U:0, N:0};
      }
      if (val==='S') taskStats[code].S++;
      else if (val==='U') taskStats[code].U++;
      else taskStats[code].N++;
    });
  });
  const acsRows = Object.entries(taskStats).map(([code,t]) => {
    const total = t.S+t.U, pct = total?Math.round(t.S/total*100):null;
    const color = t.U===0?'#166534':pct>=75?'#92400e':'#7f1d1d';
    return `<tr><td>${code}</td><td>${t.name}</td>
      <td style="color:#166534">${t.S}</td><td style="color:#7f1d1d">${t.U}</td>
      <td>${pct!==null?pct+'%':'—'}</td>
      <td style="color:${color}">${t.U===0?'Proficient':pct>=75?'Improving':'Needs Work'}</td></tr>`;
  }).join('');

  // Training milestones
  const msRows = MILESTONES.map(m => {
    const d = miles[m.key] || {};
    return `<tr>
      <td>${m.label}</td>
      <td>${d.date||'—'}</td>
      <td>${d.passed===false?'Not Passed':d.date?'Passed':'—'}</td>
      <td>${d.examiner||''}</td>
      <td>${d.conditions||''}</td>
    </tr>`;
  }).join('');

  // Instructor notes per lesson
  const noteRows = ALL_LESSONS.map(l => {
    const instr = sg(sk('note', l.id+'-instr')) || '';
    const stud  = sg(sk('note', l.id+'-stud'))  || '';
    if (!instr && !stud) return '';
    return `<tr><td>${l.code}</td><td>${l.title}</td>
      <td>${instr.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</td>
      <td>${stud.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</td></tr>`;
  }).filter(Boolean).join('');

  // Personal minimums
  const minItems = MIN_FIELDS.filter(f=>f.key!=='notes'&&mins[f.key])
    .map(f=>`<li><strong>${f.label}:</strong> ${mins[f.key]} ${f.unit}</li>`).join('');
  const minNotes = mins.notes ? `<p style="margin:4px 0;font-style:italic">${mins.notes}</p>` : '';

  const signoffs = ALL_LESSON_IDS.filter(id=>getComp(id)>=4).length;

  win.document.write(`<!DOCTYPE html><html lang="en"><head>
<title>${stu.name||'Student'} — Training Record</title>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 24px; max-width: 960px; margin: 0 auto; color: #111; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 12px; margin: 18px 0 5px; padding-bottom: 3px; border-bottom: 2px solid #0d1e38; color: #0d1e38; text-transform: uppercase; letter-spacing: .06em; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
  th, td { border: 1px solid #ddd; padding: 3px 6px; vertical-align: top; text-align: left; }
  th { background: #f0f0f0; font-weight: 700; font-size: 10px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
  .profile-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-bottom: 12px; }
  .pf { padding: 5px 8px; background: #f7f7f7; border: 1px solid #ddd; border-radius: 3px; }
  .pf-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; }
  .pf-val { font-size: 11px; font-weight: 600; }
  .section-note { font-size: 10px; color: #666; margin-bottom: 6px; }
  ul { margin: 4px 0; padding-left: 18px; }
  li { margin-bottom: 2px; }
  @media print { button { display: none !important; } }
</style>
</head><body>
<h1>${stu.name||'Student'} — Private Pilot Training Record</h1>
<div class="meta">Generated ${new Date().toLocaleDateString()} · CFI Lesson Plans</div>

<h2>Student Profile</h2>
<div class="profile-grid">
  <div class="pf"><div class="pf-label">Full Name</div><div class="pf-val">${stu.name||'—'}</div></div>
  <div class="pf"><div class="pf-label">Date of Birth</div><div class="pf-val">${stu.dob||'—'}</div></div>
  <div class="pf"><div class="pf-label">Cert Number</div><div class="pf-val">${stu.cert||'—'}</div></div>
  <div class="pf"><div class="pf-label">Medical Class</div><div class="pf-val">${stu.medClass||'—'}</div></div>
  <div class="pf"><div class="pf-label">Medical Expiry</div><div class="pf-val">${stu.medExp||'—'}</div></div>
  <div class="pf"><div class="pf-label">Training Start</div><div class="pf-val">${stu.start||'—'}</div></div>
  <div class="pf"><div class="pf-label">Email</div><div class="pf-val">${stu.email||'—'}</div></div>
  <div class="pf"><div class="pf-label">Phone</div><div class="pf-val">${stu.phone||'—'}</div></div>
</div>

<h2>§61.109 Hour Requirements</h2>
<table><tr><th>Requirement</th><th>Logged</th><th>Required</th><th>Status</th></tr>${hrRows}</table>

<h2>Knowledge Test (PAR)</h2>
<table><tr><th>Date</th><th>Score</th><th>Status</th><th>Deficient Subjects</th></tr>
<tr>
  <td>${ktest.date||'—'}</td>
  <td>${ktest.score!=null&&ktest.score!==0?ktest.score+'%':'—'}</td>
  <td style="color:${ktest.score>=70?'#166534':'#7f1d1d'}">${ktest.date?(ktest.score>=70?'✓ Passed':'✗ Failed'):'Not taken'}</td>
  <td>${ktest.deficiencies?.length?(ktest.deficiencies.map(i=>PAR_SUBJECTS[i]).join(', ')):'None recorded'}</td>
</tr></table>

<h2>Training Milestones</h2>
<table><tr><th>Milestone</th><th>Date</th><th>Result</th><th>Examiner</th><th>Conditions / Notes</th></tr>${msRows}</table>

<h2>Endorsements Completed</h2>
${endItems
  ? `<table><tr><th>Code</th><th>Endorsement</th><th>Date</th></tr>${endItems}</table>`
  : '<p class="section-note">No endorsements marked complete.</p>'}

<h2>Lesson Competency (${signoffs}/${ALL_LESSON_IDS.length} Signed Off)</h2>
<table><tr><th>Code</th><th>Lesson</th><th>Level</th></tr>${compRows}</table>

<h2>ACS Task Performance</h2>
${acsRows
  ? `<table><tr><th>Code</th><th>Task</th><th>S</th><th>U</th><th>S%</th><th>Status</th></tr>${acsRows}</table>`
  : '<p class="section-note">No ACS task grades recorded yet.</p>'}

<h2>Flight Log (${flights.length} entries)</h2>
<table><tr><th>Date</th><th>Aircraft</th><th>Lesson</th><th>Gnd</th><th>Flt(hr)</th><th>Ldgs</th><th>Type</th><th>Grade</th><th>Notes</th></tr>
${flights.map(f=>`<tr>
  <td>${f.date||''}</td><td>${f.aircraft||''}</td>
  <td style="max-width:120px">${f.lessonTitle||''}</td>
  <td>${f.ground||''}</td><td>${f.flightTime||''}</td><td>${f.landings||''}</td>
  <td>${[f.dual&&'D',f.solo&&'S',f.night&&'N',f.xc&&'XC',f.sim&&'IR',f.nightTos&&'NT'].filter(Boolean).join(' ')}</td>
  <td>${GRADES[f.grade]||''}</td><td>${f.notes||''}</td>
</tr>`).join('')}</table>

${minItems||minNotes ? `<h2>Personal Minimums</h2><ul>${minItems}</ul>${minNotes}` : ''}

${noteRows ? `<h2>Instructor Notes by Lesson</h2>
<table><tr><th>Code</th><th>Lesson</th><th>Instructor Notes</th><th>Session Notes</th></tr>${noteRows}</table>` : ''}

<br><button onclick="window.print()" style="padding:8px 20px;background:#0d1e38;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Print / Save PDF</button>
</body></html>`);
  win.document.close();
});

// ── Feature 10: Notes search (extends existing search index) ───
// Patch buildSearchIndex to include instructor notes from localStorage
const _origBuild = buildSearchIndex;
function buildSearchIndex() {
  _origBuild();
  if (!searchIndex) return;
  searchIndex.forEach(entry => {
    const instrNote = sg(sk('note', entry.sid+'-instr')) || '';
    const studNote  = sg(sk('note', entry.sid+'-stud'))  || '';
    entry.text += ' ' + instrNote.toLowerCase() + ' ' + studNote.toLowerCase();
    entry.noteRaw = instrNote + ' ' + studNote;
  });
}


// ── ENDORSEMENTS ───────────────────────────────────────────────
// END_DATA_JS is injected as a global constant in JS_HEAD

// ── Tab switching ──────────────────────────────────────────────
document.querySelectorAll('.end-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.end-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.end-tab-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    const panel = document.getElementById('epanel-' + tab.dataset.tab);
    if (panel) panel.style.display = '';
  });
});

// ── Category accordion ─────────────────────────────────────────
document.querySelectorAll('.end-cat-header').forEach(hdr => {
  hdr.addEventListener('click', () => {
    const body = hdr.nextElementSibling;
    const open = body.classList.toggle('open');
    hdr.setAttribute('aria-expanded', open);
  });
  hdr.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
  });
});

// ── Signature block preview ────────────────────────────────────
function updateSigPreview() {
  const name = (document.getElementById('cfi-name')?.value || '[CFI Name]').trim();
  const cert = (document.getElementById('cfi-cert-num')?.value || '[Cert #]').trim();
  const re   = document.getElementById('cfi-re-date')?.value || '';
  const exp  = document.getElementById('cfi-cert-exp')?.value || '';
  const today = new Date().toLocaleDateString('en-US', {year:'numeric',month:'2-digit',day:'2-digit'});
  let sig;
  if (exp) {
    sig = `/s/ ${today}  ${name}  ${cert}CFI  Exp. ${exp}`;
  } else {
    sig = `/s/ ${today}  ${name}  ${cert}CFI  RE ${re || '[RE End Date]'}`;
  }
  const el = document.getElementById('end-sig-preview');
  if (el) el.textContent = sig;
  return sig;
}

function loadEndorsements() {
  // Load per-student tracker state
  document.querySelectorAll('.end-cb').forEach(cb => {
    const eid = cb.dataset.eid;
    cb.checked = CFIData.endorsements.getDone(eid);
    cb.closest('.end-card')?.classList.toggle('completed', cb.checked);
    if (cb.dataset.bound !== '1') {
      cb.dataset.bound = '1';
      cb.addEventListener('change', () => {
        CFIData.endorsements.setDone(eid, cb.checked);
        cb.closest('.end-card')?.classList.toggle('completed', cb.checked);
        updateEndProgress();
        updateCatCounts();
      });
    }
  });
  document.querySelectorAll('.end-date').forEach(inp => {
    const eid = inp.dataset.eid;
    inp.value = CFIData.endorsements.getDate(eid);
    if (inp.dataset.bound !== '1') {
      inp.dataset.bound = '1';
      inp.addEventListener('change', () => CFIData.endorsements.setDate(eid, inp.value));
    }
  });
  document.querySelectorAll('.end-notes').forEach(ta => {
    const eid = ta.dataset.eid;
    ta.value = CFIData.endorsements.getNotes(eid);
    if (ta.dataset.bound !== '1') {
      ta.dataset.bound = '1';
      ta.addEventListener('input', () => CFIData.endorsements.setNotes(eid, ta.value));
    }
  });

  // CFI info — global (not per-student)
  ['cfi-name','cfi-cert-num','cfi-re-date','cfi-cert-exp'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = CFIData.settings.get(id, '') || '';
    if (el.dataset.bound !== '1') {
      el.dataset.bound = '1';
      const persist = () => { CFIData.settings.set(id, el.value); updateSigPreview(); };
      el.addEventListener('input', persist);
      el.addEventListener('change', persist);
    }
  });
  updateSigPreview();

  // "Generate →" buttons on tracker cards open generator pre-selected
  document.querySelectorAll('.end-gen-btn[data-eid]').forEach(btn => {
    if (btn.dataset.bound !== '1') {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const eid = btn.dataset.eid;
        const entry = END_DATA_JS.find(e => e.id === eid);
        if (!entry) return;
        // Switch to generator tab
        document.querySelectorAll('.end-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.end-tab-panel').forEach(p => p.style.display = 'none');
        document.getElementById('etab-generator').classList.add('active');
        document.getElementById('epanel-generator').style.display = '';
        // Pre-select category and endorsement
        const catSel = document.getElementById('gen-cat');
        catSel.value = entry.cat;
        populateGenTypes(entry.cat);
        document.getElementById('gen-type').value = entry.id;
        onGenTypeChange();
        // Store for mark-done
        document.getElementById('gen-mark-done-btn')._eid = eid;
        document.getElementById('gen-mark-done-btn').style.display = '';
      });
    }
  });

  updateEndProgress();
  updateCatCounts();
}

function updateEndProgress() {
  const total = document.querySelectorAll('.end-cb').length;
  const done = [...document.querySelectorAll('.end-cb')].filter(c => c.checked).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const fill = document.getElementById('end-prog-fill');
  if (fill) fill.style.width = pct + '%';
  const cnt = document.getElementById('end-count');
  if (cnt) cnt.textContent = `${done} of ${total} completed`;
}

function updateCatCounts() {
  // Group cards by category header
  document.querySelectorAll('.end-category').forEach(cat => {
    const cbs = [...cat.querySelectorAll('.end-cb')];
    const done = cbs.filter(c => c.checked).length;
    const total = cbs.length;
    const el = cat.querySelector('.end-cat-count');
    if (!el) return;
    el.textContent = `${done}/${total}`;
    el.className = 'end-cat-count' + (done === total && total > 0 ? ' cat-done' : done > 0 ? ' cat-partial' : '');
  });
}

// ── Generator ──────────────────────────────────────────────────
function populateGenTypes(cat) {
  const sel = document.getElementById('gen-type');
  sel.innerHTML = '<option value="">Select endorsement…</option>';
  END_DATA_JS.filter(e => e.cat === cat).forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.id} – ${e.label}`;
    sel.appendChild(opt);
  });
}

// All possible placeholder fields
const ALL_FIELDS = ['pilotName','certGrade','certNum','aircraftMM','catClass',
  'airport','classB','altAirport','route','testName','typeRating',
  'gliderLaunch','wings_level','wings_phase','date','conditions'];

function onGenTypeChange() {
  const sel = document.getElementById('gen-type');
  const entry = END_DATA_JS.find(e => e.id === sel.value);
  if (!entry) return;
  // Show only fields used in this template
  ALL_FIELDS.forEach(f => {
    const row = document.getElementById('genf-' + f);
    if (row) row.style.display = entry.tmpl.includes('{{' + f + '}}') ? '' : 'none';
  });
  // Clear output
  document.getElementById('gen-output').value = '';
  // Update AC note
  const note = document.getElementById('gen-ac-note');
  if (note) note.textContent = `AC 61-65K Appendix A · ${entry.id} · ${entry.far}`;
  // Show mark-done button
  const mdb = document.getElementById('gen-mark-done-btn');
  if (mdb) { mdb._eid = entry.id; mdb.style.display = ''; }
}

document.getElementById('gen-cat')?.addEventListener('change', e => {
  populateGenTypes(e.target.value);
  document.getElementById('gen-type').value = '';
  ALL_FIELDS.forEach(f => {
    const row = document.getElementById('genf-' + f);
    if (row) row.style.display = 'none';
  });
  document.getElementById('gen-output').value = '';
});

document.getElementById('gen-type')?.addEventListener('change', onGenTypeChange);

document.getElementById('gen-generate-btn')?.addEventListener('click', () => {
  const sel = document.getElementById('gen-type');
  const entry = END_DATA_JS.find(e => e.id === sel.value);
  if (!entry) { alert('Select a category and endorsement first.'); return; }

  // Feature 1: Auto-fill pilot name + cert# from active student profile
  const stu = students.find(s => s.id === activeId);
  const pilotNameEl = document.getElementById('gen-pilotName');
  const certNumEl   = document.getElementById('gen-certNum');
  if (pilotNameEl && !pilotNameEl.value.trim() && stu?.name)
    pilotNameEl.value = stu.name;
  if (certNumEl && !certNumEl.value.trim() && stu?.cert)
    certNumEl.value = stu.cert;

  const vals = {};
  ALL_FIELDS.forEach(f => {
    const el = document.getElementById('gen-' + f);
    vals['{{' + f + '}}'] = el ? el.value.trim() : '';
  });

  let text = entry.tmpl;
  Object.keys(vals).forEach(ph => {
    text = text.replaceAll(ph, vals[ph] || ph.replace(/[{}]/g,''));
  });

  // Append CFI signature block
  const sig = updateSigPreview();
  text += '\n\n' + sig;

  document.getElementById('gen-output').value = text;
});

document.getElementById('gen-copy-btn')?.addEventListener('click', () => {
  const out = document.getElementById('gen-output');
  if (!out.value) return;
  navigator.clipboard.writeText(out.value).then(() => {
    const btn = document.getElementById('gen-copy-btn');
    const orig = btn.innerHTML;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  });
});

document.getElementById('gen-clear-btn')?.addEventListener('click', () => {
  ALL_FIELDS.forEach(f => {
    const el = document.getElementById('gen-' + f);
    if (el) el.value = '';
  });
  document.getElementById('gen-output').value = '';
  document.getElementById('gen-type').value = '';
  document.getElementById('gen-cat').value = '';
  ALL_FIELDS.forEach(f => {
    const row = document.getElementById('genf-' + f);
    if (row) row.style.display = 'none';
  });
});

document.getElementById('gen-mark-done-btn')?.addEventListener('click', function() {
  const eid = this._eid;
  if (!eid) return;
  const cb = document.querySelector(`.end-cb[data-eid="${eid}"]`);
  if (cb) {
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    // Also set today's date
    const dateInp = document.querySelector(`.end-date[data-eid="${eid}"]`);
    if (dateInp && !dateInp.value) {
      const today = new Date().toISOString().split('T')[0];
      dateInp.value = today;
      ss(sk('end', eid+'-date'), today);
    }
    this.textContent = '✓ Marked complete';
    setTimeout(() => { this.textContent = '✓ Mark this endorsement complete for current student'; }, 2000);
  }
});

// Hide all generator fields initially
ALL_FIELDS.forEach(f => {
  const row = document.getElementById('genf-' + f);
  if (row) row.style.display = 'none';
});



// ── Feature 3: ACS Task Performance Trend ──────────────────────
function renderAcsTrend() {
  const container = document.getElementById('acs-trend-wrap');
  if (!container) return;
  const flights = getFlights();
  if (!flights.length) {
    container.innerHTML = '<div class="act-empty">No flights logged yet — grade ACS tasks in the flight modal to see trends.</div>';
    return;
  }

  // Aggregate S/U/N counts per task code
  const taskStats = {};   // code → {name, S, U, N, sessions, last}
  flights.forEach(f => {
    if (!f.acsTasks || typeof f.acsTasks !== 'object') return;
    Object.entries(f.acsTasks).forEach(([code, val]) => {
      if (!taskStats[code]) {
        // Find the task name from ALL_LESSONS
        let name = code;
        for (const l of ALL_LESSONS) {
          const t = (l.acsTasks || []).find(t => t.code === code);
          if (t) { name = t.title; break; }
        }
        taskStats[code] = { code, name, S: 0, U: 0, N: 0, sessions: 0, last: '', history: [] };
      }
      const ts = taskStats[code];
      if (val === 'S') ts.S++;
      else if (val === 'U') ts.U++;
      else ts.N++;
      ts.sessions++;
      if (!ts.last || f.date > ts.last) ts.last = f.date;
      ts.history.push({ date: f.date, val });
    });
  });

  const tasks = Object.values(taskStats).sort((a, b) => {
    // Sort: U-heavy first, then by code
    const aPrio = a.U / (a.sessions || 1);
    const bPrio = b.U / (b.sessions || 1);
    return bPrio - aPrio || a.code.localeCompare(b.code);
  });

  if (!tasks.length) {
    container.innerHTML = '<div class="act-empty">No ACS task grades found. Use the ACS Task Performance section in the flight modal when logging flights.</div>';
    return;
  }

  const rows = tasks.map(t => {
    const total = t.S + t.U;  // excluding N/A
    const pctS  = total ? Math.round(t.S / total * 100) : 0;
    // Build sparkline dots from chronological history
    const hist  = [...t.history].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const dots  = hist.slice(-10).map(h =>
      `<span class="act-dot ${h.val === 'S' ? 'sat' : h.val === 'U' ? 'unsat' : 'na'}" title="${h.date}: ${h.val}"></span>`
    ).join('');
    const trend = t.U === 0 ? 'strong' : (t.U <= 1 || pctS >= 75) ? 'ok' : 'needs-work';
    const trendLabel = trend === 'strong' ? '✓ Proficient' : trend === 'ok' ? '⚑ Improving' : '✗ Needs Work';
    return `<tr class="act-row act-${trend}">
      <td class="act-code">${t.code}</td>
      <td class="act-name">${t.name}</td>
      <td class="act-sat">${t.S}</td>
      <td class="act-unsat">${t.U}</td>
      <td class="act-na">${t.N}</td>
      <td class="act-pct">${total ? pctS + '%' : '—'}</td>
      <td class="act-spark">${dots}</td>
      <td class="act-trend-cell"><span class="act-trend ${trend}">${trendLabel}</span></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="act-meta">${tasks.length} tasks graded across ${flights.filter(f=>f.acsTasks&&Object.keys(f.acsTasks).length).length} flights</div>
    <div class="act-table-wrap">
      <table class="act-table">
        <thead>
          <tr>
            <th>Task</th><th>Name</th>
            <th title="Satisfactory">S</th>
            <th title="Unsatisfactory">U</th>
            <th title="Not Applicable">N/A</th>
            <th>S%</th>
            <th>Last 10</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Feature 8: Quick-Brief overlay ─────────────────────────────
(function() {
  const overlay = document.getElementById('quick-brief-overlay');
  const body    = document.getElementById('qb-body');
  const titleEl = document.getElementById('qb-title-label');
  const closeBtn= document.getElementById('qb-close');
  if (!overlay) return;

  closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    document.body.classList.remove('qb-open');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.style.display = 'none'; document.body.classList.remove('qb-open'); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      overlay.style.display = 'none'; document.body.classList.remove('qb-open');
    }
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.quick-brief-btn');
    if (!btn) return;
    const sid = btn.dataset.sid;
    const section = document.querySelector(`.lesson-section[data-lesson-id="${sid}"]`);
    if (!section) return;

    // Pull title
    const code  = section.querySelector('.lesson-code')?.textContent || '';
    const title = section.querySelector('.lesson-title')?.textContent || '';
    titleEl.textContent = (code ? code + ' · ' : '') + title;

    // Pull refs row
    const refsEl = section.querySelector('.lb-refs-text');
    const refs   = refsEl ? `<div class="qb-refs"><strong>References:</strong> ${refsEl.innerHTML}</div>` : '';

    // Pull meta table rows we care about
    const metaRows = {};
    section.querySelectorAll('.lb-table tr').forEach(tr => {
      const th = tr.querySelector('th')?.textContent?.trim();
      const td = tr.querySelector('td')?.innerHTML || '';
      if (th) metaRows[th] = td;
    });

    const objective = metaRows['Objectives'] || metaRows['Objective'] || '';
    const keyElems  = metaRows['Key Elements'] || '';
    const elements  = metaRows['Elements'] || '';
    const schedule  = metaRows['Schedule'] || '';
    const equipment = metaRows['Equipment'] || '';
    const standards = metaRows['Completion Standards'] || '';

    // Pull ACS block
    const acsBlock = section.querySelector('.lesson-acs');
    const acsTasks = acsBlock?.querySelector('.acs-tasks')?.outerHTML || '';
    const riskItems= acsBlock?.querySelector('.acs-risk ul')?.outerHTML || '';
    const debriefItems = acsBlock?.querySelector('.acs-debrief ul')?.outerHTML || '';

    // Build clean brief HTML
    const section_html = (label, content) => content
      ? `<div class="qb-section"><div class="qb-section-label">${label}</div><div class="qb-section-body">${content}</div></div>`
      : '';

    body.innerHTML = `
      ${refs}
      ${section_html('Objective', objective)}
      ${section_html('Key Elements', keyElems)}
      ${section_html('Elements', elements)}
      ${acsTasks ? `<div class="qb-section"><div class="qb-section-label">ACS Tasks</div><div class="qb-section-body">${acsTasks}</div></div>` : ''}
      ${riskItems ? `<div class="qb-section"><div class="qb-section-label">Risk Prompts</div><div class="qb-section-body"><ul class="qb-risk-list">${riskItems}</ul></div></div>` : ''}
      ${section_html('Schedule', schedule)}
      ${section_html('Equipment', equipment)}
      ${section_html('Completion Standards', standards)}
      ${debriefItems ? `<div class="qb-section"><div class="qb-section-label">Debrief Prompts</div><div class="qb-section-body"><ul class="qb-debrief-list">${debriefItems}</ul></div></div>` : ''}
    `;

    overlay.style.display = 'flex';
    document.body.classList.add('qb-open');
  });
})();

// ── Feature 9: ACS Standards ───────────────────────────────────
let stdRendered = false;
function renderStandards() {
  const grid = document.getElementById('std-grid');
  if (!grid) return;

  if (!stdRendered) {
    stdRendered = true;
    const cards = ACS_STANDARDS.map(std => {
      const rows = std.tols.map(t =>
        `<tr><td class="std-metric">${t.metric}</td><td class="std-tol">${t.tol}</td></tr>`
      ).join('');
      return `<div class="std-card" data-code="${std.code}" data-cat="${std.cat}">
        <div class="std-card-head">
          <span class="std-card-code">${std.code}</span>
          <span class="std-card-name">${std.name}</span>
        </div>
        <table class="std-tol-table"><tbody>${rows}</tbody></table>
      </div>`;
    }).join('');
    grid.innerHTML = cards;
  }

  // Wire search + filter (idempotent)
  if (grid.dataset.wired) return;
  grid.dataset.wired = '1';

  const searchEl = document.getElementById('std-search');
  const catBtns  = document.querySelectorAll('.std-cat');

  function applyFilter() {
    const q   = searchEl?.value.toLowerCase().trim() || '';
    const cat = document.querySelector('.std-cat.active')?.dataset.cat || '';
    document.querySelectorAll('.std-card').forEach(card => {
      const matchQ   = !q || card.textContent.toLowerCase().includes(q);
      const matchCat = !cat || card.dataset.cat === cat;
      card.style.display = (matchQ && matchCat) ? '' : 'none';
    });
  }

  searchEl?.addEventListener('input', applyFilter);
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    });
  });

  // Wire standards view tabs (ACS / METAR / Phonetic)
  const refTabs = document.querySelectorAll('#ref-tabs .ref-tab');
  refTabs.forEach(tab => {
    if (tab.dataset.wiredTab) return;
    tab.dataset.wiredTab = '1';
    tab.addEventListener('click', () => {
      refTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['acs','metar','phonetic'].forEach(id => {
        const el = document.getElementById(`ref-panel-${id}`);
        if (el) el.style.display = (id === tab.dataset.tab) ? '' : 'none';
      });
    });
  });
}

// ── Features 6 & 11: Flight Tools (W&B + Takeoff Performance) ──
let toolsInited = false;
function initFlightTools() {
  if (toolsInited) return;
  toolsInited = true;

  // ── Tab wiring ─────────────────────────────────────────────────
  const toolsTabs = document.querySelectorAll('#tools-tabs .ref-tab');
  toolsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      toolsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['wb','perf','land','wx'].forEach(id => {
        const el = document.getElementById(`tools-panel-${id}`);
        if (el) el.style.display = (id === tab.dataset.toolstab) ? '' : 'none';
      });
    });
  });

  // ── W&B Calculator ─────────────────────────────────────────────
  // PA-28-140 station arms (inches aft of datum = inboard LE of wing)
  const WB_ARMS = {
    empty:  { id: 'wb-empty-wt',  arm_id: 'wb-empty-arm',  moment_id: 'wb-moment-empty', dynamic_arm: true },
    front:  { id: 'wb-front-wt',  arm: 80.5,  moment_id: 'wb-moment-front' },
    rear:   { id: 'wb-rear-wt',   arm: 118.1, moment_id: 'wb-moment-rear' },
    bag:    { id: 'wb-bag-wt',    arm: 142.8, moment_id: 'wb-moment-bag' },
    fuel:   { id: 'wb-fuel-gal',  arm: 95.0,  moment_id: 'wb-moment-fuel', fuel: true },
  };
  const WB_CG_FWD = 82.0, WB_CG_AFT = 93.0, WB_MAX_GWT = 2150;

  function calcWB() {
    let totalWt = 0, totalMoment = 0;
    Object.values(WB_ARMS).forEach(item => {
      const wtEl = document.getElementById(item.id);
      if (!wtEl) return;
      let wt = parseFloat(wtEl.value) || 0;
      if (item.fuel) wt = wt * 6.0;  // gal → lbs
      const arm = item.dynamic_arm
        ? (parseFloat(document.getElementById(item.arm_id)?.value) || 84.0)
        : item.arm;
      const moment = wt * arm;
      const momEl = document.getElementById(item.moment_id);
      if (momEl) momEl.textContent = wt > 0 ? moment.toFixed(0) : '—';
      totalWt += wt;
      totalMoment += moment;
    });

    const cg = totalWt > 0 ? totalMoment / totalWt : 0;
    document.getElementById('wb-total-wt').textContent    = totalWt > 0 ? totalWt.toFixed(1) : '—';
    document.getElementById('wb-total-moment').textContent= totalWt > 0 ? totalMoment.toFixed(0) : '—';
    document.getElementById('wb-res-wt').textContent = totalWt > 0 ? `${totalWt.toFixed(1)} lbs` : '—';
    document.getElementById('wb-res-cg').textContent = totalWt > 0 ? `${cg.toFixed(2)} in aft` : '—';

    const statusEl = document.getElementById('wb-status');
    let status = '', statusClass = '';
    if (totalWt <= 0) { status = 'Enter values'; statusClass = ''; }
    else if (totalWt > WB_MAX_GWT) { status = `OVER MAX GROSS by ${(totalWt - WB_MAX_GWT).toFixed(0)} lbs`; statusClass = 'wb-bad'; }
    else if (cg < WB_CG_FWD) { status = `CG FORWARD of limit (${cg.toFixed(2)} in < ${WB_CG_FWD} in)`; statusClass = 'wb-bad'; }
    else if (cg > WB_CG_AFT) { status = `CG AFT of limit (${cg.toFixed(2)} in > ${WB_CG_AFT} in)`; statusClass = 'wb-bad'; }
    else { status = `✓ Within limits  (${WB_CG_FWD}–${WB_CG_AFT} in)`; statusClass = 'wb-good'; }
    if (statusEl) { statusEl.textContent = status; statusEl.className = 'wb-result-val wb-status ' + statusClass; }

    drawWBEnvelope(totalWt, cg);
  }

  function drawWBEnvelope(wt, cg) {
    const canvas = document.getElementById('wb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // PA-28-140 CG envelope points (weight lbs vs CG inches)
    // From POH: simplified trapezoidal envelope
    const envPts = [
      [1500, 82.0], [1500, 93.0],  // light weight limits
      [2150, 82.0], [2150, 93.0],  // gross weight limits
    ];
    // Map: weight 1200–2200, CG 78–97
    const wtMin=1200, wtMax=2200, cgMin=78, cgMax=98;
    const mx = x => Math.round((x-cgMin)/(cgMax-cgMin)*(W-50)+25);
    const my = y => Math.round((1-(y-wtMin)/(wtMax-wtMin))*(H-40)+20);

    // Draw envelope fill
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? 'rgba(22,163,74,.18)' : 'rgba(22,163,74,.12)';
    ctx.beginPath();
    ctx.moveTo(mx(82.0), my(1500));
    ctx.lineTo(mx(93.0), my(1500));
    ctx.lineTo(mx(93.0), my(2150));
    ctx.lineTo(mx(82.0), my(2150));
    ctx.closePath(); ctx.fill();

    // Envelope border
    ctx.strokeStyle = isDark ? '#4ade80' : '#16a34a';
    ctx.lineWidth = 2; ctx.stroke();

    // Axes
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(25, 20); ctx.lineTo(25, H-20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, H-20); ctx.lineTo(W-20, H-20); ctx.stroke();

    // Labels
    ctx.fillStyle = isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)';
    ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CG (in aft datum)', W/2, H-4);
    ctx.save(); ctx.translate(10, H/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('Weight (lbs)', 0, 0); ctx.restore();

    // Tick marks
    ctx.textAlign = 'center';
    [82, 85, 88, 91, 93].forEach(cg => {
      const x = mx(cg);
      ctx.beginPath(); ctx.moveTo(x, H-20); ctx.lineTo(x, H-15); ctx.stroke();
      ctx.fillText(cg, x, H-8);
    });
    ctx.textAlign = 'right';
    [1500, 1800, 2150].forEach(w => {
      const y = my(w);
      ctx.beginPath(); ctx.moveTo(25, y); ctx.lineTo(30, y); ctx.stroke();
      ctx.fillText(w, 23, y+3);
    });

    // Plot the current CG point
    if (wt > 0 && cg > 0) {
      const px = mx(cg), py = my(wt);
      const inEnv = wt <= WB_MAX_GWT && cg >= WB_CG_FWD && cg <= WB_CG_AFT;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI*2);
      ctx.fillStyle = inEnv ? '#16a34a' : '#dc2626';
      ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // Wire W&B inputs
  document.querySelectorAll('.wb-inp').forEach(el => {
    el.addEventListener('input', calcWB);
  });
  calcWB();  // initial render with defaults

  // ── Takeoff Performance Calculator ─────────────────────────────
  // POH baselines at 2150 lbs, SL, ISA, no wind, hard surface, flaps up
  const PERF_BASE = { ground_roll: 800, obstacle: 1700 };
  const PERF_SHORT = { ground_roll: 730, obstacle: 1440 }; // 25° flaps

  document.getElementById('perf-calc-btn')?.addEventListener('click', () => {
    const pa       = parseFloat(document.getElementById('perf-pa')?.value)   || 0;
    const oat      = parseFloat(document.getElementById('perf-oat')?.value)  ?? 15;
    const wt       = parseFloat(document.getElementById('perf-wt')?.value)   || 2150;
    const hw       = parseFloat(document.getElementById('perf-hw')?.value)   || 0;
    const surface  = parseFloat(document.getElementById('perf-surface')?.value) || 1.0;
    const flaps    = document.getElementById('perf-flaps')?.value || 'up';

    // Density altitude
    const isa = 15 - (pa / 1000) * 2;     // ISA temp at pressure altitude
    const da  = pa + (oat - isa) * 120;    // standard density altitude formula

    // Weight correction: per POH, ±10% per ~200 lbs from 2150
    const wtFactor = 1 + ((wt - 2150) / 200) * -0.10; // lighter = shorter

    // DA correction: +10% per 1000 ft DA (POH rule of thumb)
    const daFactor = 1 + Math.max(0, da) / 1000 * 0.10;

    // Wind correction: -10% per 9 kts headwind, +10% per 2 kts tailwind
    const hwFactor = hw >= 0
      ? Math.max(0.5, 1 - (hw / 9) * 0.10)
      : 1 + (Math.abs(hw) / 2) * 0.10;

    const base = flaps === '25' ? PERF_SHORT : PERF_BASE;
    const gr   = Math.round(base.ground_roll * wtFactor * daFactor * hwFactor * surface);
    const obs  = Math.round(base.obstacle    * wtFactor * daFactor * hwFactor * surface);

    // Vy / Vx at density altitude (approximate: Vy decreases ~1 kt per 1000 ft DA)
    const vy_kts = Math.round(74 - da / 1000);
    const vx_kts = Math.round(64 - da / 2000);

    // Go/no-go color
    const color = gr < 1500 ? 'perf-green' : gr < 2500 ? 'perf-amber' : 'perf-red';
    const daColor = da < 3000 ? 'perf-green' : da < 6000 ? 'perf-amber' : 'perf-red';

    document.getElementById('perf-results').innerHTML = `
      <div class="perf-res-grid">
        <div class="perf-res-card ${daColor}">
          <div class="perf-res-label">Density Altitude</div>
          <div class="perf-res-val">${Math.round(da).toLocaleString()} ft</div>
          <div class="perf-res-sub">PA ${pa.toLocaleString()} ft · OAT ${oat}°C · ISA${oat >= isa ? '+' : ''}${(oat-isa).toFixed(0)}°C</div>
        </div>
        <div class="perf-res-card ${color}">
          <div class="perf-res-label">Ground Roll</div>
          <div class="perf-res-val">${gr.toLocaleString()} ft</div>
          <div class="perf-res-sub">Flaps ${flaps === 'up' ? '0°' : '25°'}</div>
        </div>
        <div class="perf-res-card ${color}">
          <div class="perf-res-label">50-ft Obstacle</div>
          <div class="perf-res-val">${obs.toLocaleString()} ft</div>
          <div class="perf-res-sub">Total distance</div>
        </div>
        <div class="perf-res-card">
          <div class="perf-res-label">Vy at DA</div>
          <div class="perf-res-val">${vy_kts} KIAS</div>
          <div class="perf-res-sub">≈ ${Math.round(vy_kts * 1.15)} MPH</div>
        </div>
        <div class="perf-res-card">
          <div class="perf-res-label">Vx at DA</div>
          <div class="perf-res-val">${vx_kts} KIAS</div>
          <div class="perf-res-sub">≈ ${Math.round(vx_kts * 1.15)} MPH</div>
        </div>
      </div>
      <div class="perf-factors">
        <strong>Correction factors applied:</strong>
        Weight (${wt} lbs): ×${wtFactor.toFixed(3)} ·
        Density alt (${Math.round(da).toLocaleString()} ft): ×${daFactor.toFixed(3)} ·
        Wind (${hw >= 0 ? hw + ' kts HW' : Math.abs(hw) + ' kts TW'}): ×${hwFactor.toFixed(3)} ·
        Surface: ×${surface.toFixed(2)}
      </div>
      <div class="perf-disclaimer">⚠ Estimates only. Always verify with the aircraft's POH charts. Apply a minimum 50% safety margin to all computed distances.</div>`;
  });

  // ── Feature 4: Landing Distance Calculator ─────────────────────
  // POH baselines (2150 lbs, SL, ISA, no wind, paved, full flaps)
  const LAND_BASE = { roll: 535, obstacle: 870 };

  document.getElementById('land-calc-btn')?.addEventListener('click', () => {
    const pa      = parseFloat(document.getElementById('land-pa')?.value)   || 0;
    const oat     = parseFloat(document.getElementById('land-oat')?.value)  ?? 15;
    const wt      = parseFloat(document.getElementById('land-wt')?.value)   || 2150;
    const hw      = parseFloat(document.getElementById('land-hw')?.value)   || 0;
    const surface = parseFloat(document.getElementById('land-surface')?.value) || 1.0;
    const flaps   = document.getElementById('land-flaps')?.value || 'full';

    const isa = 15 - (pa / 1000) * 2;
    const da  = pa + (oat - isa) * 120;

    // Correction factors (same methodology as takeoff)
    const wtFactor   = 1 + ((wt - 2150) / 200) * -0.08;
    const daFactor   = 1 + Math.max(0, da) / 1000 * 0.07;   // +7% per 1000 ft DA
    const hwFactor   = hw >= 0
      ? Math.max(0.5, 1 - (hw / 9) * 0.10)
      : 1 + (Math.abs(hw) / 2) * 0.15;   // tailwind doubles distance faster
    const flapFactor = flaps === 'partial' ? 1.25 : flaps === 'none' ? 1.5 : 1.0;

    const roll  = Math.round(LAND_BASE.roll     * wtFactor * daFactor * hwFactor * surface * flapFactor);
    const obs   = Math.round(LAND_BASE.obstacle * wtFactor * daFactor * hwFactor * surface * flapFactor);
    // Approach speed (Vref = 1.3 × Vso = 1.3 × 47 kts ≈ 61 kts; POH says ~65 KIAS / 75 mph)
    const vapp  = 65;

    const color = roll < 1000 ? 'perf-green' : roll < 1800 ? 'perf-amber' : 'perf-red';
    const daColor = da < 3000 ? 'perf-green' : da < 6000 ? 'perf-amber' : 'perf-red';

    document.getElementById('land-results').innerHTML = `
      <div class="perf-res-grid">
        <div class="perf-res-card ${daColor}">
          <div class="perf-res-label">Density Altitude</div>
          <div class="perf-res-val">${Math.round(da).toLocaleString()} ft</div>
          <div class="perf-res-sub">PA ${pa.toLocaleString()} ft · OAT ${oat}°C</div>
        </div>
        <div class="perf-res-card ${color}">
          <div class="perf-res-label">Landing Roll</div>
          <div class="perf-res-val">${roll.toLocaleString()} ft</div>
          <div class="perf-res-sub">Flaps ${flaps==='full'?'40° (full)':flaps==='partial'?'25°':'0° (none)'}</div>
        </div>
        <div class="perf-res-card ${color}">
          <div class="perf-res-label">50-ft Obstacle</div>
          <div class="perf-res-val">${obs.toLocaleString()} ft</div>
          <div class="perf-res-sub">Total distance</div>
        </div>
        <div class="perf-res-card">
          <div class="perf-res-label">Approach Speed</div>
          <div class="perf-res-val">${vapp} KIAS</div>
          <div class="perf-res-sub">≈ ${Math.round(vapp*1.15)} MPH</div>
        </div>
      </div>
      <div class="perf-factors">
        Weight (${wt} lbs): ×${wtFactor.toFixed(3)} · DA (${Math.round(da).toLocaleString()} ft): ×${daFactor.toFixed(3)} ·
        Wind (${hw>=0?hw+' kts HW':Math.abs(hw)+' kts TW'}): ×${hwFactor.toFixed(3)} ·
        Surface: ×${surface.toFixed(2)} · Flaps: ×${flapFactor.toFixed(2)}
      </div>
      <div class="perf-disclaimer">⚠ Estimates only. Technique, obstacle clearance, and brake condition significantly affect actual landing distance. Apply ≥50% safety margin.</div>`;
  });
}

const selectEl = document.getElementById('student-select');
function rebuildSelect() {
  students = getStudents();
  selectEl.innerHTML = '';
  students.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    if (s.id === activeId) o.selected = true;
    selectEl.appendChild(o);
  });
  document.querySelector('.sps-name').textContent = students.find(s=>s.id===activeId)?.name || '';
}
selectEl.addEventListener('change', () => {
  activeId = selectEl.value; setActiveId(activeId);
  loadAll();
});

// Add student modal
const addModal = document.getElementById('modal-add');
document.getElementById('btn-add-student').addEventListener('click', () => { document.getElementById('new-student-name').value = ''; addModal.classList.add('open'); setTimeout(()=>document.getElementById('new-student-name').focus(),100); });
addModal.querySelector('.modal-close').addEventListener('click', () => addModal.classList.remove('open'));
addModal.addEventListener('click', e => { if(e.target===addModal) addModal.classList.remove('open'); });
document.getElementById('btn-add-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-student-name').value.trim();
  if (!name) return;
  const s = { id: mkId(), name };
  students.push(s); saveStudents(students);
  activeId = s.id; setActiveId(activeId);
  rebuildSelect(); loadAll();
  addModal.classList.remove('open');
});
document.getElementById('new-student-name').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-add-confirm').click(); });

// ── Feature 2: Student Profile Modal ───────────────────────────
const manageModal  = document.getElementById('modal-manage');
const profileModal = document.getElementById('modal-profile');
let profileSid = null;

function openProfileModal(sid) {
  profileSid = sid;
  const s = getStudents().find(s => s.id === sid) || {};
  document.getElementById('prof-name').value      = s.name    || '';
  document.getElementById('prof-email').value     = s.email   || '';
  document.getElementById('prof-phone').value     = s.phone   || '';
  document.getElementById('prof-dob').value       = s.dob     || '';
  document.getElementById('prof-cert').value      = s.cert    || '';
  document.getElementById('prof-start').value     = s.start   || '';
  document.getElementById('prof-med-class').value = s.medClass|| '';
  document.getElementById('prof-med-exp').value   = s.medExp  || '';
  document.getElementById('prof-notes').value     = s.profNotes || '';
  profileModal.classList.add('open');
  setTimeout(() => document.getElementById('prof-name').focus(), 100);
}
document.getElementById('prof-save-btn').addEventListener('click', () => {
  const all = getStudents();
  const idx = all.findIndex(s => s.id === profileSid);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    name:      document.getElementById('prof-name').value.trim()  || all[idx].name,
    email:     document.getElementById('prof-email').value.trim(),
    phone:     document.getElementById('prof-phone').value.trim(),
    dob:       document.getElementById('prof-dob').value,
    cert:      document.getElementById('prof-cert').value.trim(),
    start:     document.getElementById('prof-start').value,
    medClass:  document.getElementById('prof-med-class').value,
    medExp:    document.getElementById('prof-med-exp').value,
    profNotes: document.getElementById('prof-notes').value.trim(),
  };
  saveStudents(all);
  students = all;
  rebuildSelect();
  rebuildManageList();
  profileModal.classList.remove('open');
  // Refresh student name in dashboard
  const nameEl = document.getElementById('dash-student-name');
  const stu = all.find(s => s.id === activeId);
  if (nameEl && stu) nameEl.textContent = stu.name;
  renderDashboard();
});
document.getElementById('prof-cancel-btn').addEventListener('click', () => profileModal.classList.remove('open'));
profileModal.querySelector('.modal-close').addEventListener('click', () => profileModal.classList.remove('open'));
profileModal.addEventListener('click', e => { if (e.target === profileModal) profileModal.classList.remove('open'); });

// Manage modal — now includes profile + select + delete
document.getElementById('btn-manage-student').addEventListener('click', () => { rebuildManageList(); manageModal.classList.add('open'); });
manageModal.querySelector('.modal-close').addEventListener('click', () => manageModal.classList.remove('open'));
manageModal.addEventListener('click', e => { if(e.target===manageModal) manageModal.classList.remove('open'); });

function renderMedBadge(s) {
  if (!s.medExp) return '';
  const exp = new Date(s.medExp);
  const now = new Date();
  const days = Math.ceil((exp - now) / 86400000);
  if (days < 0) return '<span class="med-badge expired">Medical Expired</span>';
  if (days < 30) return `<span class="med-badge warn">Medical exp. ${days}d</span>`;
  return `<span class="med-badge ok">${s.medClass || 'Medical'} · exp ${s.medExp}</span>`;
}

function rebuildManageList() {
  const ul = document.getElementById('manage-student-list');
  ul.innerHTML = '';
  students = getStudents();
  students.forEach(s => {
    const done = ALL_LESSON_IDS.filter(sid => parseInt(sg(`${s.id}|comp|${sid}`)||'0') >= 4).length;
    const pct  = ALL_LESSON_IDS.length ? Math.round(done / ALL_LESSON_IDS.length * 100) : 0;
    const li = document.createElement('li');
    li.className = 'sti';
    li.innerHTML = `
      <div class="sti-info">
        <span class="sti-name">${s.name}</span>
        <span class="sti-meta">
          ${s.cert  ? `Cert: ${s.cert} · ` : ''}
          ${s.start ? `Started: ${s.start} · ` : ''}
          ${pct}% signed off
        </span>
        ${s.email ? `<span class="sti-meta">${s.email}</span>` : ''}
        ${renderMedBadge(s)}
      </div>
      <div class="sti-btns">
        <button class="sti-profile" data-sid="${s.id}" title="Edit profile">✎ Profile</button>
        <button class="sti-sel" data-sid="${s.id}">Select</button>
        <button class="sti-del" data-sid="${s.id}">✕</button>
      </div>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.sti-profile').forEach(b => b.addEventListener('click', () => {
    manageModal.classList.remove('open');
    openProfileModal(b.dataset.sid);
  }));
  ul.querySelectorAll('.sti-sel').forEach(b => b.addEventListener('click', () => {
    activeId = b.dataset.sid; setActiveId(activeId); rebuildSelect(); loadAll();
    manageModal.classList.remove('open');
  }));
  ul.querySelectorAll('.sti-del').forEach(b => b.addEventListener('click', () => {
    const s = students.find(x => x.id === b.dataset.sid);
    if (!confirm(`Delete ${s?.name || 'this student'} and all their data?`)) return;
    CFIData.students.purgeData(b.dataset.sid);
    students = students.filter(s => s.id !== b.dataset.sid);
    if (!students.length) students = [{id:'s1', name:'Student 1'}];
    saveStudents(students);
    if (activeId === b.dataset.sid) { activeId = students[0].id; setActiveId(activeId); }
    rebuildSelect(); loadAll(); rebuildManageList();
  }));
}

// ── Feature 9: Personal Minimums ───────────────────────────────
const MIN_FIELDS = [
  { id:'min-xwind',    label:'Max Crosswind',           unit:'kts',    key:'xwind' },
  { id:'min-ceiling',  label:'Min Ceiling VFR',         unit:'ft AGL', key:'ceiling' },
  { id:'min-vis',      label:'Min Visibility VFR',      unit:'SM',     key:'vis' },
  { id:'min-xc-wind',  label:'Max Demo XC Wind',        unit:'kts',    key:'xcwind' },
  { id:'min-night-ldg',label:'Night Currency (90 days)',unit:'ldgs',   key:'nightldg' },
  { id:'min-solo-hrs', label:'Solo Hrs Before XC',      unit:'hrs',    key:'soloHrs' },
  { id:'min-notes',    label:'Notes',                   unit:'',       key:'notes' },
];




function renderMinimums() {
  const display = document.getElementById('minimums-display');
  if (!display) return;
  const data = getMins();
  const hasAny = MIN_FIELDS.some(f => f.key !== 'notes' && data[f.key]);
  if (!hasAny && !data.notes) {
    display.innerHTML = '<p class="min-empty">No personal minimums set. Click Edit to add.</p>';
    return;
  }
  const chips = MIN_FIELDS.filter(f => f.key !== 'notes' && data[f.key]).map(f =>
    `<div class="min-chip"><span class="min-chip-label">${f.label}</span><span class="min-chip-val">${data[f.key]} ${f.unit}</span></div>`
  ).join('');
  const notes = data.notes ? `<div class="min-notes-disp">${data.notes.replace(/\n/g,'<br>')}</div>` : '';
  display.innerHTML = `<div class="min-chips">${chips}</div>${notes}`;
}

document.getElementById('minimums-edit-btn')?.addEventListener('click', () => {
  const data = getMins();
  MIN_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) el.value = data[f.key] || '';
  });
  document.getElementById('minimums-editor').style.display = '';
  document.getElementById('minimums-display').style.display = 'none';
  document.getElementById('minimums-edit-btn').style.display = 'none';
});
document.getElementById('minimums-save-btn')?.addEventListener('click', () => {
  const data = {};
  MIN_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) data[f.key] = el.value.trim();
  });
  saveMins(data);
  document.getElementById('minimums-editor').style.display = 'none';
  document.getElementById('minimums-display').style.display = '';
  document.getElementById('minimums-edit-btn').style.display = '';
  renderMinimums();
});
document.getElementById('minimums-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('minimums-editor').style.display = 'none';
  document.getElementById('minimums-display').style.display = '';
  document.getElementById('minimums-edit-btn').style.display = '';
});

// ── Feature 11: Drag-to-reorder sidebar lesson groups ──────────
(function() {
  const NAV_ORDER_KEY = 'nav-group-order';  // global, not per-student
  const scroll = document.getElementById('nav-scroll');
  let dragSrc = null;

  function getGroups() {
    return [...scroll.querySelectorAll('.nav-group')];
  }
  function saveOrder() {
    const order = getGroups().map(g => g.dataset.gid);
    CFIData.settings.setNavOrder(order);
  }
  function loadOrder() {
    try {
      const saved = CFIData.settings.getNavOrder();
      if (!saved || !Array.isArray(saved)) return;
      const groups = getGroups();
      const map = Object.fromEntries(groups.map(g => [g.dataset.gid, g]));
      // Find the divider to insert after
      const divider = scroll.querySelector('.nav-divider');
      saved.forEach(gid => {
        if (map[gid]) scroll.appendChild(map[gid]);
      });
    } catch {}
  }

  // Add drag handles to each nav-group-header
  function initDragHandles() {
    getGroups().forEach(group => {
      const hdr = group.querySelector('.nav-group-header');
      if (!hdr || hdr.querySelector('.nav-drag-handle')) return;
      const handle = document.createElement('span');
      handle.className = 'nav-drag-handle';
      handle.title = 'Drag to reorder';
      handle.innerHTML = '⠿';
      handle.setAttribute('aria-label', 'Reorder');
      hdr.insertBefore(handle, hdr.firstChild);
    });

    getGroups().forEach(group => {
      group.setAttribute('draggable', 'true');
      group.addEventListener('dragstart', e => {
        dragSrc = group;
        group.classList.add('drag-source');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', group.dataset.gid);
      });
      group.addEventListener('dragend', () => {
        group.classList.remove('drag-source');
        getGroups().forEach(g => g.classList.remove('drag-over'));
        saveOrder();
      });
      group.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrc && dragSrc !== group) {
          getGroups().forEach(g => g.classList.remove('drag-over'));
          group.classList.add('drag-over');
        }
      });
      group.addEventListener('dragleave', () => group.classList.remove('drag-over'));
      group.addEventListener('drop', e => {
        e.preventDefault();
        group.classList.remove('drag-over');
        if (dragSrc && dragSrc !== group) {
          const groups = getGroups();
          const srcIdx = groups.indexOf(dragSrc);
          const tgtIdx = groups.indexOf(group);
          if (srcIdx < tgtIdx) scroll.insertBefore(dragSrc, group.nextSibling);
          else                  scroll.insertBefore(dragSrc, group);
          saveOrder();
        }
      });
    });
  }

  loadOrder();
  initDragHandles();

  // "Reset order" button — injected into nav divider
  const divider = scroll.querySelector('.nav-divider');
  if (divider) {
    const resetBtn = document.createElement('button');
    resetBtn.className = 'nav-reset-order';
    resetBtn.title = 'Reset to default order';
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', () => {
      CFIData.settings.clearNavOrder();
      location.reload();
    });
    divider.appendChild(resetBtn);
  }
})();


// ── Feature 7: Aircraft V-Speeds Popover ───────────────────────
// Default data: 1967 Piper Cherokee 140 (PA-28-140)
// All speeds in KIAS; mph shown in parentheses as original POH units
const VSPEEDS_DEFAULTS = {
  aircraft: '1967 Piper PA-28-140 Cherokee 140',
  speeds: [
    { code:'Vne',  label:'Never Exceed',              kts:148,  mph:171,  color:'red',   note:'Red radial line' },
    { code:'Vno',  label:'Max Structural Cruise',      kts:122,  mph:140,  color:'yellow',note:'Top of green arc' },
    { code:'Va',   label:'Maneuvering Speed',          kts:112,  mph:129,  color:'',      note:'At 2,150 lbs MGTOW' },
    { code:'Vfe',  label:'Max Flap Extended',          kts:100,  mph:115,  color:'white', note:'Top of white arc' },
    { code:'Vy',   label:'Best Rate of Climb',         kts:74,   mph:85,   color:'',      note:'660 FPM at MGTOW' },
    { code:'Vx',   label:'Best Angle of Climb',        kts:64,   mph:74,   color:'',      note:'Obstacle clearance' },
    { code:'Vg',   label:'Best Glide',                 kts:72,   mph:83,   color:'',      note:'Max glide range' },
    { code:'Vs1',  label:'Stall Speed (Clean)',        kts:56,   mph:64,   color:'green', note:'Bottom of green arc' },
    { code:'Vso',  label:'Stall Speed (Landing Config)',kts:47,  mph:54,   color:'white', note:'Bottom of white arc' },
    { code:'Vr',   label:'Rotation Speed',             kts:50,   mph:58,   color:'',      note:'55-65 mph; lift-off at lowest safe airspeed' },
    { code:'Vapp', label:'Normal Approach',            kts:65,   mph:75,   color:'',      note:'~1.3×Vso; use 70-75 mph on final' },
  ]
};

const VSPEEDS_KEY = 'aircraft-vspeeds';




function renderVspeedsPopover() {
  const body = document.getElementById('vsp-body');
  const nameEl = document.getElementById('vsp-aircraft-name');
  if (!body) return;
  const data = getVspeeds();
  if (nameEl) nameEl.textContent = data.aircraft || 'Aircraft';

  // Color band headers
  const colorLabels = { red:'Never Exceed', yellow:'Caution Range', white:'Flap Range', green:'Normal Ops', '':'Key Speeds' };
  body.innerHTML = `
    <!-- POH summary row -->
    <div class="vsp-summary">
      <span class="vsp-sum-item"><b>Engine:</b> Lycoming O-320-E2A · 140 HP @ 2,450 RPM</span>
      <span class="vsp-sum-item"><b>MGTOW:</b> 2,150 lbs</span>
      <span class="vsp-sum-item"><b>Useful Load:</b> ~949 lbs</span>
      <span class="vsp-sum-item"><b>Fuel:</b> 36 gal std (80/87 or 100LL)</span>
      <span class="vsp-sum-item"><b>ROC:</b> 660 FPM @ MGTOW</span>
      <span class="vsp-sum-item"><b>Service Ceiling:</b> 14,300 ft</span>
      <span class="vsp-sum-item"><b>Cruise (75%):</b> 105 KIAS / 121 MPH</span>
      <span class="vsp-sum-item"><b>Fuel burn (75%):</b> 8.4 GPH</span>
    </div>
    <table class="vsp-table">
      <thead><tr>
        <th>V-Speed</th><th>Name</th><th>KIAS</th><th>MPH</th><th>Note</th>
      </tr></thead>
      <tbody>
        ${data.speeds.map(s => `<tr class="vsp-row ${s.color ? 'vsp-'+s.color : ''}">
          <td class="vsp-code">${s.code}</td>
          <td class="vsp-name">${s.label}</td>
          <td class="vsp-kts"><b>${s.kts}</b></td>
          <td class="vsp-mph">${s.mph}</td>
          <td class="vsp-note">${s.note}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <!-- Run-up limits from POH -->
    <div class="vsp-runup">
      <div class="vsp-runup-label">Run-Up (2,000 RPM)</div>
      <div class="vsp-runup-items">
        <span class="vsp-ri">Mag drop max: <b>175 RPM</b></span>
        <span class="vsp-ri">Mag differential max: <b>50 RPM</b></span>
        <span class="vsp-ri">Vacuum: <b>5.0 ±1.0 "Hg</b></span>
        <span class="vsp-ri">Oil pressure: <b>25–60 PSI</b></span>
        <span class="vsp-ri">Oil temp: <b>75–245 °F</b></span>
        <span class="vsp-ri">Carb heat: check for drop + recovery</span>
      </div>
    </div>`;
}

function openVspeedsEditor() {
  const data = getVspeeds();
  const grid = document.getElementById('vsp-edit-grid');
  const inp  = document.getElementById('vsp-aircraft-input');
  if (!grid) return;
  if (inp) inp.value = data.aircraft || '';
  grid.innerHTML = data.speeds.map((s, i) =>
    `<div class="vsp-edit-row">
      <span class="vsp-edit-code">${s.code}</span>
      <span class="vsp-edit-label">${s.label}</span>
      <label class="vsp-edit-field">KIAS <input type="number" class="vsp-edit-input" data-idx="${i}" data-field="kts" value="${s.kts}" min="0" max="300"></label>
      <label class="vsp-edit-field">MPH  <input type="number" class="vsp-edit-input" data-idx="${i}" data-field="mph" value="${s.mph}" min="0" max="350"></label>
    </div>`).join('');
  document.getElementById('vsp-body').style.display = 'none';
  document.getElementById('vsp-editor').style.display = '';
}

(function() {
  const popover = document.getElementById('vspeeds-popover');
  const toggleBtn = document.getElementById('btn-vspeeds');
  const closeBtn  = document.getElementById('vsp-close');
  const editBtn   = document.getElementById('vsp-edit-btn');
  const saveBtn   = document.getElementById('vsp-save-btn');
  const resetBtn  = document.getElementById('vsp-reset-btn');
  if (!popover) return;

  function showPop() {
    renderVspeedsPopover();
    document.getElementById('vsp-body').style.display = '';
    document.getElementById('vsp-editor').style.display = 'none';
    popover.style.display = '';
  }
  function hidePop() { popover.style.display = 'none'; }

  toggleBtn?.addEventListener('click', e => {
    e.stopPropagation();
    popover.style.display === 'none' ? showPop() : hidePop();
  });
  closeBtn?.addEventListener('click', hidePop);
  editBtn?.addEventListener('click', () => openVspeedsEditor());
  resetBtn?.addEventListener('click', () => {
    if (!confirm('Reset to Cherokee 140 defaults?')) return;
    saveVspeeds(VSPEEDS_DEFAULTS);
    document.getElementById('vsp-body').style.display = '';
    document.getElementById('vsp-editor').style.display = 'none';
    renderVspeedsPopover();
  });
  saveBtn?.addEventListener('click', () => {
    const data = getVspeeds();
    const inp = document.getElementById('vsp-aircraft-input');
    if (inp) data.aircraft = inp.value.trim() || data.aircraft;
    document.querySelectorAll('.vsp-edit-input').forEach(el => {
      const i = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      if (data.speeds[i] && field) data.speeds[i][field] = parseInt(el.value) || 0;
    });
    saveVspeeds(data);
    document.getElementById('vsp-body').style.display = '';
    document.getElementById('vsp-editor').style.display = 'none';
    renderVspeedsPopover();
  });
  document.addEventListener('click', e => {
    if (!popover.contains(e.target) && e.target !== toggleBtn) hidePop();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hidePop();
  });
})();

// ── Feature 9: Lesson Prev/Next Navigation ──────────────────────
(function() {
  // Build ordered list of all lesson IDs in sidebar sequence
  const lessonIds = ALL_LESSON_IDS; // already in TOC order

  function scrollToLesson(sid) {
    switchView('lessons');
    setTimeout(() => {
      const el = document.getElementById(sid);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); trackVisit(sid); }
    }, 80);
  }

  function updateLnfLabels() {
    document.querySelectorAll('.lesson-nav-footer').forEach(footer => {
      const sid = footer.dataset.sid;
      const idx = lessonIds.indexOf(sid);
      const prevBtn = footer.querySelector('.lnf-prev');
      const nextBtn = footer.querySelector('.lnf-next');
      const label   = footer.querySelector('.lnf-label');

      const prevId = idx > 0 ? lessonIds[idx - 1] : null;
      const nextId = idx < lessonIds.length - 1 ? lessonIds[idx + 1] : null;

      if (prevBtn) {
        prevBtn.style.visibility = prevId ? '' : 'hidden';
        if (prevId) {
          const prevLesson = ALL_LESSONS.find(l => l.id === prevId);
          prevBtn.title = prevLesson ? prevLesson.code + ' ' + prevLesson.title : '';
        }
      }
      if (nextBtn) {
        nextBtn.style.visibility = nextId ? '' : 'hidden';
        if (nextId) {
          const nextLesson = ALL_LESSONS.find(l => l.id === nextId);
          nextBtn.title = nextLesson ? nextLesson.code + ' ' + nextLesson.title : '';
        }
      }
      if (label) {
        label.textContent = `${idx + 1} / ${lessonIds.length}`;
      }
    });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.lnf-btn');
    if (!btn) return;
    const sid = btn.dataset.sid;
    const dir = btn.dataset.dir;
    const idx = lessonIds.indexOf(sid);
    const targetId = dir === 'prev'
      ? (idx > 0 ? lessonIds[idx - 1] : null)
      : (idx < lessonIds.length - 1 ? lessonIds[idx + 1] : null);
    if (targetId) scrollToLesson(targetId);
  });

  // Run once after DOM is ready
  updateLnfLabels();
})();

// ── Load everything for current student ────────────────────────
function loadAll() {
  loadCompetencies();
  loadNotesAndChecks();
  loadEndorsements();
  renderFlightLog();
  renderDashboard();
  renderMinimums();
  renderMilestones();
  renderKtest();
  updatePaceIndicator();
  updateStudentStatsChip();
  initNavTooltips();
  updateGroupFractions();
  const strip = document.querySelector('.sps-name');
  if (strip) strip.textContent = students.find(s=>s.id===activeId)?.name || '';
}

// ── GALLERY LIGHTBOX ───────────────────────────────────────────
let galleryFullData = null;   // lazy-parsed from <script> block
let lbSid = null;             // current open gallery section id
let lbIdx = 0;                // current slide index
let lbTotal = 0;

function getFullData() {
  if (!galleryFullData) {
    try {
      galleryFullData = JSON.parse(
        document.getElementById('gallery-full-data').textContent
      );
    } catch(e) { galleryFullData = {}; }
  }
  return galleryFullData;
}

const sharedLb    = document.getElementById('shared-lightbox');
const glbImg      = document.getElementById('glb-img');
const glbCounter  = document.getElementById('glb-counter');
const glbClose    = document.getElementById('glb-close');
const glbPrev     = document.getElementById('glb-prev');
const glbNext     = document.getElementById('glb-next');

function showLbSlide(idx) {
  const full = getFullData();
  const slides = full[lbSid];
  if (!slides) return;
  lbIdx = ((idx % slides.length) + slides.length) % slides.length;
  glbImg.src = 'data:image/jpeg;base64,' + slides[lbIdx];
  glbImg.alt = 'Diagram ' + (lbIdx + 1);
  if (glbCounter) glbCounter.textContent = (lbIdx + 1) + ' / ' + lbTotal;
}

function openLightbox(sid, idx) {
  const full = getFullData();
  lbSid   = sid;
  lbTotal = (full[sid] || []).length;
  sharedLb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showLbSlide(idx);
}

function closeLightbox() {
  sharedLb.style.display = 'none';
  document.body.style.overflow = '';
  glbImg.src = '';   // free memory
}

glbClose.addEventListener('click', closeLightbox);
glbPrev.addEventListener('click',  () => showLbSlide(lbIdx - 1));
glbNext.addEventListener('click',  () => showLbSlide(lbIdx + 1));
sharedLb.addEventListener('click', e => { if (e.target === sharedLb) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (sharedLb.style.display === 'none') return;
  if (e.key === 'Escape')                  closeLightbox();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') showLbSlide(lbIdx + 1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   showLbSlide(lbIdx - 1);
});

// Wire up all inline image figures as lightbox triggers
function initGalleries() {
  document.querySelectorAll('.inline-img').forEach(fig => {
    fig.addEventListener('click', () => {
      const sid = fig.dataset.sid;
      const idx = parseInt(fig.dataset.idx, 10);
      openLightbox(sid, idx);
    });
  });
}

// ── INIT ───────────────────────────────────────────────────────
