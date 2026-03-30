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

function getSortedFlightsDesc() {
  return getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
}

function buildFlightLogSummary(flights) {
  const totalTime = flights.reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const totalDual = flights.filter(f=>f.dual).reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  const totalSolo = flights.filter(f=>f.solo).reduce((s,f) => s + parseFloat(f.flightTime||0), 0);
  return `${flights.length} entries · ${totalTime.toFixed(1)} hrs total · ${totalDual.toFixed(1)} dual · ${totalSolo.toFixed(1)} solo`;
}

function syncReactFlightLog() {
  if (!window.CFIReactFlightLog?.isAvailable?.()) return false;
  window.CFIReactFlightLog.render();
  return true;
}

function notifyFlightLogChanged() {
  CFIApp.notifyFlightsChanged?.({
    activeId,
    count: getFlights().length,
    reason: 'flight-log',
  });
  CFIApp.getModule('dashboard')?.refresh?.();
  CFIApp.refreshSettingsMeta?.();
}

function renderFlightLog() {
  if (syncReactFlightLog()) return;
  const flights = getSortedFlightsDesc();
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
      CFIData.analytics.logEvent?.('flight-deleted', { source: 'vanilla-flightlog' });
      renderFlightLog();
      notifyFlightLogChanged();
      CFIApp.notify?.('Flight entry deleted.', { tone: 'success' });
    });
  });
  tbody.querySelectorAll('.fl-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openFlightModal(null, null, parseInt(btn.dataset.idx), getSortedFlightsDesc());
    });
  });
  const sumEl = document.getElementById('fl-summary');
  if (sumEl) sumEl.textContent = buildFlightLogSummary(flights);
}

// ── §61.109 Hour Requirements Calculator ───────────────────────
const FAR_REQS = window.CFIDashboardSelectors.FAR_REQS;

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
    e.preventDefault(); CFIApp.switchView('endorsements');
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
  if (window.CFIReactDashboard?.isAvailable?.()) {
    window.CFIReactDashboard.render();
    return;
  }
  const model = window.CFIDashboardSelectors.getDashboardViewModel();
  const flights = getFlights().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const stu = model.student || students.find(s=>s.id===activeId) || students[0];

  const nameEl = document.getElementById('dash-student-name');
  const avatarEl = document.getElementById('dash-avatar');
  const subEl = document.getElementById('dash-student-sub');
  if (nameEl) nameEl.textContent = stu?.name || 'Student';
  if (avatarEl) avatarEl.textContent = (stu?.name||'S')[0].toUpperCase();

  document.getElementById('dstat-flights').textContent = String(model.stats.flights);
  document.getElementById('dstat-time').textContent = model.stats.time;
  document.getElementById('dstat-lessons').textContent = String(model.stats.lessons);
  document.getElementById('dstat-signoffs').textContent = String(model.stats.signoffs);
  if (subEl) subEl.textContent = model.subtitle;
  const paceEl = document.getElementById('dstat-pace');
  if (paceEl) {
    paceEl.textContent = model.stats.pace.label;
    paceEl.style.color = model.stats.pace.color;
    paceEl.title = model.stats.pace.title;
  }

  const pct = model.checklist.pct;
  const ring = document.getElementById('dash-ring');
  const ringPct = document.getElementById('dash-ring-pct');
  if (ring) { const circ = 2*Math.PI*22; ring.style.strokeDashoffset = circ-(circ*pct/100); }
  if (ringPct) ringPct.textContent = pct+'%';

  // next lesson
  const nextLessonEl = document.getElementById('dash-next-lesson');
  if (nextLessonEl) {
    const next = model.nextLesson;
    if (next) {
      const lv = next.level || 0;
      nextLessonEl.innerHTML = `<div class="dnl-code">${next.code}</div><div class="dnl-title">${next.title}</div><div class="dnl-comp"><span style="color:${['#9399a8','#3b82f6','#f59e0b','#16a34a','#0f5132'][lv]}">●</span> ${COMP_LABELS[lv]}</div><button class="dnl-btn" data-sid="${next.id}">Open Lesson →</button>`;
      nextLessonEl.querySelector('.dnl-btn').addEventListener('click', () => {
        CFIApp.switchView('lessons');
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
          CFIApp.switchView('lessons');
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
const flModeToggle = document.getElementById('fl-mode-toggle');
const flDetailsPanel = document.getElementById('fl-details-panel');
let flModalLessonId = null;
let flEditIdx = null;          // null = new entry, number = editing existing

function setFlightModalMode(expanded) {
  if (!flModeToggle || !flDetailsPanel) return;
  const isExpanded = !!expanded;
  flDetailsPanel.classList.toggle('collapsed', !isExpanded);
  flModeToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  flModeToggle.textContent = isExpanded ? 'Hide Details' : 'Show Details';
}

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

  setFlightModalMode(!!entry);
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
flModeToggle?.addEventListener('click', () => {
  const expanded = flModeToggle.getAttribute('aria-expanded') === 'true';
  setFlightModalMode(!expanded);
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
  if (!date) { CFIApp.notify?.('Enter a flight date before saving.', { tone: 'error' }); return; }
  ss('cfi-aircraft', aircraft);

  const allFlights = getFlights();                          // unsorted, original order
  const sorted     = getSortedFlightsDesc();

  const updated = { date, aircraft, lessonId: lessonSel,
    lessonTitle: lesson ? lesson.code+' '+lesson.title : lessonSel,
    ground, flightTime, landings, grade, notes,
    dual, solo, night, xc, sim, nightTos, acsTasks };

  const wasEditing = flEditIdx != null;
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
  CFIData.analytics.logEvent?.(wasEditing ? 'flight-edited' : 'flight-added', {
    lessonId: lessonSel,
    aircraft,
  });
  renderFlightLog();
  notifyFlightLogChanged();
  CFIApp.notify?.(wasEditing ? 'Flight entry updated.' : 'Flight entry saved.', { tone: 'success' });
  if (lessonSel) {
    CFIApp.showNotice?.(
      wasEditing
        ? 'Flight updated. Refresh the related lesson while the session details are still fresh.'
        : 'Flight saved. Update the related lesson before moving on.',
      [
        { label: 'Open Lesson', onClick: () => CFIApp.getModule('lessons')?.openLesson?.(lessonSel) },
        { label: 'Dismiss', onClick: () => CFIApp.hideNotice?.() },
      ]
    );
  }
});

// ── Feature 1: Data Backup & Restore ──────────────────────────
document.getElementById('settings-backup-btn')?.addEventListener('click', () => {
  try {
    CFIApp.setBusyButton?.('settings-backup-btn', true, 'Exporting...');
    const data = CFIData.settings.exportAll();
    const stu = students.find(s => s.id === activeId);
    const filename = `cfi-backup-${(stu?.name||'data').replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    // Flash confirmation
    const btn = document.getElementById('settings-backup-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Saved';
      setTimeout(() => btn.textContent = orig, 2000);
    }
    CFIApp.notify?.('Backup exported successfully.', { tone: 'success' });
    CFIApp.refreshSettingsMeta?.();
  } catch(e) {
    CFIApp.notify?.('Backup failed. Check browser storage permissions and try again.', { tone: 'error', duration: 4200 });
    return;
  } finally {
    CFIApp.setBusyButton?.('settings-backup-btn', false, null, '⬇ Export Backup');
  }
});

document.getElementById('settings-restore-btn')?.addEventListener('click', () => {
  document.getElementById('backup-file-input').click();
});
document.getElementById('backup-file-input')?.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  CFIApp.setBusyButton?.('settings-restore-btn', true, 'Reading...');
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const summary = CFIData.settings.describeImport(data);
      const exportedAt = summary.exportedAt ? `\nExported: ${summary.exportedAt}` : '';
      const sourceMode = summary.appMode ? `\nSource mode: ${summary.appMode}` : '';
      if (!confirm(`Restore ${summary.keyCount} items from "${file.name}"?${exportedAt}${sourceMode}\n\nThis will MERGE with existing data (existing keys will be overwritten). Current data is NOT erased first.\n\nA local recovery snapshot will be saved automatically before the restore.`)) return;
      CFIData.settings.captureRecoverySnapshot?.('pre-restore-import');
      const restored = CFIData.settings.importAll(data);
      CFIApp.notify?.(`Restore complete. ${restored} saved items were imported. Reloading now…`, { tone: 'success', duration: 3600 });
      location.reload();
    } catch(err) {
      CFIApp.notify?.('Restore failed. The backup file could not be read.', { tone: 'error', duration: 4200 });
    } finally {
      CFIApp.setBusyButton?.('settings-restore-btn', false, null, '⬆ Import / Restore');
    }
  };
  reader.onerror = () => {
    CFIApp.setBusyButton?.('settings-restore-btn', false, null, '⬆ Import / Restore');
    CFIApp.notify?.('Restore failed while reading the backup file.', { tone: 'error', duration: 4200 });
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
    const target = e.target;
    const vspeedsBtn = document.getElementById('settings-vspeeds-btn');
    if (!settingsPop.contains(target) && target !== settingsBtn && target !== vspeedsBtn) hideSettings();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideSettings(); });
  // V-speeds button inside settings opens V-speeds popover
  document.getElementById('settings-vspeeds-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    hideSettings();
    const vp = document.getElementById('vspeeds-popover');
    if (vp) {
      renderVspeedsPopover();
      setTimeout(() => { vp.style.display = ''; }, 0);
    }
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
function updateStudentStatsChip() {
  const chip = document.getElementById('student-stats-chip');
  const nameEl = document.getElementById('active-student-name');
  const metaEl = document.getElementById('active-student-meta');
  const allStudents = getStudents();
  const student = allStudents.find(s => s.id === activeId) || allStudents[0] || { name: 'Student 1' };
  const flights = getFlights();
  const totalHrs = flights.reduce((s, f) => s + parseFloat(f.flightTime || 0), 0);
  const signoffs = ALL_LESSON_IDS.filter(id => getComp(id) >= 4).length;
  const ktest = getKtest();
  const miles = getMilestones();
  const readyChecks = [
    FAR_REQS.every(r => { const t = calcHours(); return t[r.key] >= r.req; }),
    ['A1','A2','A3','A4','A6','A9','A36','A37'].every(eid => sg(sk('end', eid + '-done')) === '1'),
    signoffs >= Math.floor(ALL_LESSON_IDS.length * 0.8),
    !!(ktest.date && ktest.score >= 70),
    MILESTONES.every(m => { const d = miles[m.key] || {}; return d.date && d.passed !== false; }),
  ];
  const ready = readyChecks.filter(Boolean).length;

  if (nameEl) nameEl.textContent = student?.name || 'Student';
  if (metaEl) {
    if (!signoffs && !flights.length) metaEl.textContent = 'Ready to begin training';
    else if (!flights.length) metaEl.textContent = `${signoffs} lessons signed off · log first flight`;
    else metaEl.textContent = `${totalHrs.toFixed(1)} hours logged · ${signoffs} lessons signed off`;
  }
  if (!chip) return;
  chip.textContent = `${totalHrs.toFixed(1)}h · ${signoffs} signed off · ${ready}/5`;
  chip.title = `${totalHrs.toFixed(1)} hrs logged · ${signoffs}/${ALL_LESSON_IDS.length} lessons signed off · ${ready}/5 readiness checks`;
  chip.style.color = ready === 5 ? 'var(--green)' : ready >= 3 ? '#d97706' : 'var(--text-muted)';
}

// Patch renderAcsTrend to add clickable rows
function renderAcsTrend() {
  const container = document.getElementById('acs-trend-wrap');
  if (!container) return;
  const flights = getFlights();
  if (!flights.length) {
    container.innerHTML = '<div class="act-empty">No flights logged yet — grade ACS tasks in the flight modal to see trends.</div>';
    return;
  }

  const taskStats = {};
  flights.forEach(f => {
    if (!f.acsTasks || typeof f.acsTasks !== 'object') return;
    Object.entries(f.acsTasks).forEach(([code, val]) => {
      if (!taskStats[code]) {
        let name = code;
        for (const l of ALL_LESSONS) {
          const t = (l.acsTasks || []).find(task => task.code === code);
          if (t) { name = t.title; break; }
        }
        taskStats[code] = { code, name, S: 0, U: 0, N: 0, sessions: 0, last: '', history: [] };
      }
      const stats = taskStats[code];
      if (val === 'S') stats.S++;
      else if (val === 'U') stats.U++;
      else stats.N++;
      stats.sessions++;
      if (!stats.last || f.date > stats.last) stats.last = f.date;
      stats.history.push({ date: f.date, val });
    });
  });

  const tasks = Object.values(taskStats).sort((a, b) => {
    const aPrio = a.U / (a.sessions || 1);
    const bPrio = b.U / (b.sessions || 1);
    return bPrio - aPrio || a.code.localeCompare(b.code);
  });

  if (!tasks.length) {
    container.innerHTML = '<div class="act-empty">No ACS task grades found. Use the ACS Task Performance section in the flight modal when logging flights.</div>';
    return;
  }

  const rows = tasks.map(task => {
    const total = task.S + task.U;
    const pctS = total ? Math.round(task.S / total * 100) : 0;
    const hist = [...task.history].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const dots = hist.slice(-10).map(h =>
      `<span class="act-dot ${h.val === 'S' ? 'sat' : h.val === 'U' ? 'unsat' : 'na'}" title="${h.date}: ${h.val}"></span>`
    ).join('');
    const trend = task.U === 0 ? 'strong' : (task.U <= 1 || pctS >= 75) ? 'ok' : 'needs-work';
    const trendLabel = trend === 'strong' ? '✓ Proficient' : trend === 'ok' ? '⚑ Improving' : '✗ Needs Work';
    return `<tr class="act-row act-${trend}">
      <td class="act-code">${task.code}</td>
      <td class="act-name">${task.name}</td>
      <td class="act-sat">${task.S}</td>
      <td class="act-unsat">${task.U}</td>
      <td class="act-na">${task.N}</td>
      <td class="act-pct">${total ? pctS + '%' : '—'}</td>
      <td class="act-spark">${dots}</td>
      <td class="act-trend-cell"><span class="act-trend ${trend}">${trendLabel}</span></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="act-meta">${tasks.length} tasks graded across ${flights.filter(f => f.acsTasks && Object.keys(f.acsTasks).length).length} flights</div>
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

CFIApp.register('flights', {
  init() {},
  bindEvents() {},
  render() {
    renderFlightLog();
  },
  refresh() {
    renderFlightLog();
    renderAcsTrend();
  },
  openModal: openFlightModal,
  getSortedFlights: getSortedFlightsDesc,
  getSummary: buildFlightLogSummary,
  notifyChanged: notifyFlightLogChanged,
  supportsReact: true,
});

CFIApp.register('dashboard', {
  init() {},
  bindEvents() {},
  render() {
    renderDashboard();
  },
  refresh() {
    renderDashboard();
  },
  renderHistory() {
    renderSessionHistory();
  },
  renderQuiz() {
    initPreSoloQuiz();
  },
});
