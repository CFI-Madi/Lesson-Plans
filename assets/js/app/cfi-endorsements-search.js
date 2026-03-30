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
    CFIApp.notifyDashboardDataChanged?.('knowledge-test', { activeId });
  });
}

// ── Feature 5 (enhanced): Rich Print / Export Student Record ────
function printStudentRecord() {
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
}

document.getElementById('fl-export-btn')?.addEventListener('click', printStudentRecord);

// ── Feature 10: Notes search (extends existing search index) ───
// Patch buildSearchIndex to include instructor notes from localStorage
function buildSearchIndex() {
  if (searchIndex) return;
  searchIndex = [];
  document.querySelectorAll('.lesson-section[data-lesson-id]').forEach(sec => {
    const sid = sec.dataset.lessonId;
    const title = sec.querySelector('.lesson-title')?.textContent || '';
    const code = sec.querySelector('.lesson-code')?.textContent || '';
    const body = sec.querySelector('.lesson-body')?.textContent || '';
    const instrNote = sg(sk('note', sid + '-instr')) || '';
    const studNote  = sg(sk('note', sid + '-stud')) || '';
    searchIndex.push({
      sid,
      title,
      code,
      text: `${code} ${title} ${body} ${instrNote} ${studNote}`.toLowerCase(),
      raw: body,
      noteRaw: `${instrNote} ${studNote}`.trim(),
    });
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
        if (cb.checked) {
          CFIApp.notify?.('Endorsement updated. Review readiness from the dashboard when you are ready.', { tone: 'success' });
        }
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
  if (!entry) { CFIApp.notify?.('Choose an endorsement category and type first.', { tone: 'error' }); return; }

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
  CFIApp.notify?.('Endorsement text generated.', { tone: 'success' });
});

document.getElementById('gen-copy-btn')?.addEventListener('click', () => {
  const out = document.getElementById('gen-output');
  if (!out.value) {
    CFIApp.notify?.('Generate endorsement text before copying.', { tone: 'error' });
    return;
  }
  navigator.clipboard.writeText(out.value).then(() => {
    const btn = document.getElementById('gen-copy-btn');
    const orig = btn.innerHTML;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
    CFIApp.notify?.('Endorsement copied to the clipboard.', { tone: 'success' });
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

CFIApp.register('endorsements', {
  init() {},
  bindEvents() {},
  render() {
    loadEndorsements();
  },
  refresh() {
    loadEndorsements();
  },
  exportStudentRecord: printStudentRecord,
});
