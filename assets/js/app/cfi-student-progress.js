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
    if (window.CFIReactFlightLog?.isMounted?.()) return;
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
      CFIApp.switchView('lessons');
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
  const WB_INPUTS = ['wb-front-wt','wb-rear-wt','wb-bag-wt','wb-fuel-gal'];

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

  function patchInitFlightTools() {
    if (typeof window.initFlightTools !== 'function' || window.initFlightTools.__wbPatched) return false;
    const origInitTools = window.initFlightTools;
    window.initFlightTools = function() {
      origInitTools();
      loadWBLast();
      document.querySelectorAll('.wb-inp').forEach(el => {
        if (el.dataset.wbBound === '1') return;
        el.dataset.wbBound = '1';
        el.addEventListener('change', saveWBLast);
      });
    };
    window.initFlightTools.__wbPatched = true;
    return true;
  }

  if (!patchInitFlightTools()) {
    window.addEventListener('cfi:tools-ready', patchInitFlightTools, { once: true });
  }
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
  CFIApp.notifyDashboardDataChanged?.('milestones', { activeId });
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

CFIApp.register('dashboard', {
  renderHistory() {
    renderSessionHistory();
  },
  renderQuiz() {
    initPreSoloQuiz();
  },
  refresh() {
    renderDashboard();
    renderMilestones();
    renderKtest();
    updatePaceIndicator();
  },
  openMilestoneEditor,
});
