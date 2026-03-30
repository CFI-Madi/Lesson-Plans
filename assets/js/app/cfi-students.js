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
  CFIApp.setStudents(all);
  students = all;
  rebuildSelect();
  rebuildManageList();
  profileModal.classList.remove('open');
  // Refresh student name in dashboard
  const nameEl = document.getElementById('dash-student-name');
  const stu = all.find(s => s.id === activeId);
  if (nameEl && stu) nameEl.textContent = stu.name;
  renderDashboard();
  CFIApp.notify?.('Student profile saved.', { tone: 'success' });
  CFIApp.refreshSettingsMeta?.();
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
    CFIApp.setActiveStudent(b.dataset.sid);
    activeId = CFIApp.state.activeId;
    rebuildSelect();
    CFIApp.refreshStudentContext();
    manageModal.classList.remove('open');
    CFIApp.notify?.(`Switched to ${students.find(s => s.id === b.dataset.sid)?.name || 'student'}.`, { tone: 'info' });
  }));
  ul.querySelectorAll('.sti-del').forEach(b => b.addEventListener('click', () => {
    const s = students.find(x => x.id === b.dataset.sid);
    if (!confirm(`Delete ${s?.name || 'this student'} and all their data?`)) return;
    CFIData.students.purgeData(b.dataset.sid);
    students = students.filter(s => s.id !== b.dataset.sid);
    if (!students.length) students = [{id:'s1', name:'Student 1'}];
    saveStudents(students);
    CFIApp.setStudents(students);
    if (activeId === b.dataset.sid) {
      CFIApp.setActiveStudent(students[0].id);
      activeId = CFIApp.state.activeId;
    }
    rebuildSelect();
    CFIApp.refreshStudentContext();
    rebuildManageList();
    CFIApp.notify?.(`Deleted ${s?.name || 'student'} and removed their saved records.`, { tone: 'success' });
    CFIApp.refreshSettingsMeta?.();
    CFIApp.evaluateStartupNotices?.();
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
  CFIApp.notifyDashboardDataChanged?.('minimums', { activeId });
  CFIApp.notify?.('Personal minimums saved.', { tone: 'success' });
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
const VSPEEDS_DEFAULTS = {
  aircraft: '1967 Piper PA-28-140 Cherokee 140',
  sourceLabel: 'Aircraft-specific data (POH / ForeFlight)',
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
window.VSPEEDS_DEFAULTS = VSPEEDS_DEFAULTS;

const VSPEEDS_KEY = 'aircraft-vspeeds';




function renderVspeedsPopover() {
  const body = document.getElementById('vsp-body');
  const nameEl = document.getElementById('vsp-aircraft-name');
  if (!body) return;
  const data = getVspeeds() || VSPEEDS_DEFAULTS;
  const speeds = Array.isArray(data?.speeds) && data.speeds.length ? data.speeds : VSPEEDS_DEFAULTS.speeds;
  if (nameEl) nameEl.textContent = data?.aircraft || VSPEEDS_DEFAULTS.aircraft || 'Aircraft';
  const sourceLabel = data?.sourceLabel || VSPEEDS_DEFAULTS.sourceLabel || 'Aircraft-specific data';
  body.innerHTML = `
    <div class="vsp-source">
      <span class="source-chip">Aircraft-specific data</span>
      <span class="source-chip">${sourceLabel}</span>
    </div>
    <div class="source-note"><strong>Source:</strong> These values come from the aircraft profile and are separate from the lesson PDF content.</div>
    <table class="vsp-table">
      <thead><tr>
        <th>V-Speed</th><th>Name</th><th>KIAS</th><th>MPH</th><th>Note</th>
      </tr></thead>
      <tbody>
        ${speeds.map(s => `<tr class="vsp-row ${s.color ? 'vsp-'+s.color : ''}">
          <td class="vsp-code">${s.code}</td>
          <td class="vsp-name">${s.label}</td>
          <td class="vsp-kts"><b>${s.kts}</b></td>
          <td class="vsp-mph">${s.mph}</td>
          <td class="vsp-note">${s.note}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function openVspeedsEditor() {
  const data = getVspeeds() || VSPEEDS_DEFAULTS;
  const grid = document.getElementById('vsp-edit-grid');
  const inp  = document.getElementById('vsp-aircraft-input');
  if (!grid) return;
  const speeds = Array.isArray(data?.speeds) && data.speeds.length ? data.speeds : VSPEEDS_DEFAULTS.speeds;
  if (inp) inp.value = data?.aircraft || VSPEEDS_DEFAULTS.aircraft || '';
  grid.innerHTML = speeds.map((s, i) =>
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
  const settingsBtn = document.getElementById('settings-vspeeds-btn');
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
    if (!confirm('Reset to the aircraft profile defaults?')) return;
    saveVspeeds(VSPEEDS_DEFAULTS);
    document.getElementById('vsp-body').style.display = '';
    document.getElementById('vsp-editor').style.display = 'none';
    renderVspeedsPopover();
    CFIApp.notify?.('V-speeds reset to the aircraft defaults.', { tone: 'success' });
  });
  saveBtn?.addEventListener('click', () => {
    const current = getVspeeds() || VSPEEDS_DEFAULTS;
    const data = {
      aircraft: current?.aircraft || VSPEEDS_DEFAULTS.aircraft,
      sourceLabel: current?.sourceLabel || VSPEEDS_DEFAULTS.sourceLabel,
      speeds: (Array.isArray(current?.speeds) && current.speeds.length ? current.speeds : VSPEEDS_DEFAULTS.speeds).map(speed => ({ ...speed })),
    };
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
    CFIApp.notify?.('V-speeds saved.', { tone: 'success' });
  });
  document.addEventListener('click', e => {
    const target = e.target;
    if (!popover.contains(target) && target !== toggleBtn && target !== settingsBtn) hidePop();
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
    CFIApp.switchView('lessons');
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
  CFIApp.setStudents(getStudents());
  CFIApp.setActiveStudent(getActiveId(), { skipPersist: true });
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
  if (strip) strip.textContent = CFIApp.state.students.find(s=>s.id===CFIApp.state.activeId)?.name || '';
}

// ── GALLERY LIGHTBOX ───────────────────────────────────────────
let galleryFullData = null;   // lazy-parsed from external JSON or fallback <script> block
let galleryFullDataPromise = null;
let lbSid = null;             // current open gallery section id
let lbIdx = 0;                // current slide index
let lbTotal = 0;

function getGalleryDataScript() {
  return document.getElementById('gallery-full-data');
}

function parseInlineGalleryData() {
  try {
    const raw = getGalleryDataScript()?.textContent?.trim();
    if (!raw || raw === '{}' || raw === 'null') return {};
    return JSON.parse(raw);
  } catch(e) { return {}; }
}

async function getFullData() {
  if (galleryFullData) return galleryFullData;
  if (!galleryFullDataPromise) {
    galleryFullDataPromise = (async function loadGalleryData() {
      const dataSrc = getGalleryDataScript()?.dataset?.src;
      if (dataSrc && window.fetch) {
        try {
          const response = await fetch(dataSrc, { cache: 'force-cache' });
          if (response.ok) {
            const data = await response.json();
            galleryFullData = data && typeof data === 'object' ? data : {};
            return galleryFullData;
          }
        } catch(e) {}
      }
      galleryFullData = parseInlineGalleryData();
      return galleryFullData;
    })();
  }
  return galleryFullDataPromise;
}

const sharedLb    = document.getElementById('shared-lightbox');
const glbImg      = document.getElementById('glb-img');
const glbCounter  = document.getElementById('glb-counter');
const glbClose    = document.getElementById('glb-close');
const glbPrev     = document.getElementById('glb-prev');
const glbNext     = document.getElementById('glb-next');

async function showLbSlide(idx) {
  const full = await getFullData();
  const slides = full[lbSid];
  if (!slides) return;
  lbIdx = ((idx % slides.length) + slides.length) % slides.length;
  glbImg.src = 'data:image/jpeg;base64,' + slides[lbIdx];
  glbImg.alt = 'Diagram ' + (lbIdx + 1);
  if (glbCounter) glbCounter.textContent = (lbIdx + 1) + ' / ' + lbTotal;
}

async function openLightbox(sid, idx) {
  const full = await getFullData();
  lbSid   = sid;
  lbTotal = (full[sid] || []).length;
  sharedLb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (glbCounter) glbCounter.textContent = 'Loading...';
  await showLbSlide(idx);
}

function closeLightbox() {
  sharedLb.style.display = 'none';
  document.body.style.overflow = '';
  glbImg.src = '';   // free memory
}

glbClose.addEventListener('click', closeLightbox);
glbPrev.addEventListener('click',  () => { void showLbSlide(lbIdx - 1); });
glbNext.addEventListener('click',  () => { void showLbSlide(lbIdx + 1); });
sharedLb.addEventListener('click', e => { if (e.target === sharedLb) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (sharedLb.style.display === 'none') return;
  if (e.key === 'Escape')                  closeLightbox();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') void showLbSlide(lbIdx + 1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   void showLbSlide(lbIdx - 1);
});

// Wire up all inline image figures as lightbox triggers
function initGalleries() {
  document.querySelectorAll('.inline-img').forEach(fig => {
    fig.addEventListener('click', () => {
      const sid = fig.dataset.sid;
      const idx = parseInt(fig.dataset.idx, 10);
      void openLightbox(sid, idx);
    });
  });
}

// ── INIT ───────────────────────────────────────────────────────

CFIApp.register('students', {
  init() {
    initGalleries();
  },
  bindEvents() {},
  render() {
    rebuildSelect();
    renderMinimums();
  },
  refresh() {
    loadAll();
  },
  openProfileModal,
});
