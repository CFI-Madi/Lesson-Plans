function renderStandards() {
  const grid = document.getElementById('std-grid');
  if (!grid) return;

  function findLessonForStandard(code) {
    return ALL_LESSONS.find(lesson => Array.isArray(lesson.acsTasks) && lesson.acsTasks.some(task => task.code === code)) || null;
  }

  if (!stdRendered) {
    stdRendered = true;
    const cards = ACS_STANDARDS.map(std => {
      const lesson = findLessonForStandard(std.code);
      const rows = std.tols.map(t =>
        `<tr><td class="std-metric">${t.metric}</td><td class="std-tol">${t.tol}</td></tr>`
      ).join('');
      return `<div class="std-card" data-code="${std.code}" data-cat="${std.cat}">
        <div class="std-card-head">
          <span class="std-card-code">${std.code}</span>
          <span class="std-card-name">${std.name}</span>
        </div>
        <table class="std-tol-table"><tbody>${rows}</tbody></table>
        ${lesson ? `<button class="dash-flow-link std-card-link" type="button" data-lesson-id="${lesson.id}">Open related lesson</button>` : ''}
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

  if (!grid.dataset.lessonLinksWired) {
    grid.dataset.lessonLinksWired = '1';
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.std-card-link');
      if (!btn?.dataset.lessonId) return;
      e.stopPropagation();
      CFIApp.getModule?.('lessons')?.openLesson?.(btn.dataset.lessonId);
    });
  }

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
  const WB_REFERENCE = {
    emptyWeight: 1285.56,
    emptyArm: 85.2,
    maxGrossWeight: 2150,
    fuelWeightMax: 297.8,
    fuelGalMax: 297.8 / 6,
    stations: {
      front: 85.5,
      rear: 117.0,
      bag: 117.0,
      fuel: 95.0,
    },
    envelope: {
      forward: [
        [1200, 84.0],
        [1650, 84.0],
        [1975, 85.9],
        [2150, 88.4],
      ],
      aft: [
        [1200, 95.9],
        [2150, 95.9],
      ],
    },
  };
  const WB_ARMS = {
    empty:  { id: 'wb-empty-wt',  arm_id: 'wb-empty-arm',  moment_id: 'wb-moment-empty', dynamic_arm: true },
    front:  { id: 'wb-front-wt',  arm: WB_REFERENCE.stations.front, moment_id: 'wb-moment-front' },
    rear:   { id: 'wb-rear-wt',   arm: WB_REFERENCE.stations.rear, moment_id: 'wb-moment-rear' },
    bag:    { id: 'wb-bag-wt',    arm: WB_REFERENCE.stations.bag, moment_id: 'wb-moment-bag', maxWeight: 200.0 },
    fuel:   { id: 'wb-fuel-gal',  arm: WB_REFERENCE.stations.fuel, moment_id: 'wb-moment-fuel', fuel: true, maxWeight: WB_REFERENCE.fuelWeightMax },
  };
  const WB_MAX_GWT = WB_REFERENCE.maxGrossWeight;

  function getEnvelopeLimit(points, weight) {
    if (!Array.isArray(points) || !points.length) return null;
    const sorted = points.slice().sort((a, b) => a[0] - b[0]);
    if (weight <= sorted[0][0]) return sorted[0][1];
    if (weight >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
    for (let i = 1; i < sorted.length; i++) {
      const [nextWt, nextCg] = sorted[i];
      const [prevWt, prevCg] = sorted[i - 1];
      if (weight <= nextWt) {
        const ratio = (weight - prevWt) / (nextWt - prevWt || 1);
        return prevCg + ((nextCg - prevCg) * ratio);
      }
    }
    return sorted[sorted.length - 1][1];
  }

  function getCgLimits(weight) {
    return {
      forward: getEnvelopeLimit(WB_REFERENCE.envelope.forward, weight),
      aft: getEnvelopeLimit(WB_REFERENCE.envelope.aft, weight),
    };
  }

  function applyWbDefaults() {
    const emptyWtEl = document.getElementById('wb-empty-wt');
    const emptyArmEl = document.getElementById('wb-empty-arm');
    const fuelGalEl = document.getElementById('wb-fuel-gal');
    if (emptyWtEl && !parseFloat(emptyWtEl.value)) emptyWtEl.value = WB_REFERENCE.emptyWeight.toFixed(2);
    if (emptyArmEl && !parseFloat(emptyArmEl.value)) emptyArmEl.value = WB_REFERENCE.emptyArm.toFixed(1);
    if (fuelGalEl) fuelGalEl.max = WB_REFERENCE.fuelGalMax.toFixed(2);
    const frontArm = document.querySelector('#wb-front-wt')?.closest('tr')?.querySelector('.wb-arm-fixed');
    const rearArm = document.querySelector('#wb-rear-wt')?.closest('tr')?.querySelector('.wb-arm-fixed');
    const bagArm = document.querySelector('#wb-bag-wt')?.closest('tr')?.querySelector('.wb-arm-fixed');
    const fuelArm = document.querySelector('#wb-fuel-gal')?.closest('tr')?.querySelector('.wb-arm-fixed');
    if (frontArm) frontArm.textContent = `${WB_REFERENCE.stations.front.toFixed(1)} in`;
    if (rearArm) rearArm.textContent = `${WB_REFERENCE.stations.rear.toFixed(1)} in`;
    if (bagArm) bagArm.textContent = `${WB_REFERENCE.stations.bag.toFixed(1)} in`;
    if (fuelArm) fuelArm.textContent = `${WB_REFERENCE.stations.fuel.toFixed(1)} in`;
  }

  function calcWB() {
    applyWbDefaults();
    let totalWt = 0, totalMoment = 0;
    Object.values(WB_ARMS).forEach(item => {
      const wtEl = document.getElementById(item.id);
      if (!wtEl) return;
      let wt = parseFloat(wtEl.value) || 0;
      if (item.maxWeight && ((item.fuel ? wt * 6.0 : wt) > item.maxWeight)) {
        wt = item.fuel ? (item.maxWeight / 6.0) : item.maxWeight;
        wtEl.value = item.fuel ? wt.toFixed(1) : String(item.maxWeight);
      }
      if (item.fuel) wt = wt * 6.0;  // gal → lbs
      const arm = item.dynamic_arm
        ? (parseFloat(document.getElementById(item.arm_id)?.value) || WB_REFERENCE.emptyArm)
        : item.arm;
      const moment = wt * arm;
      const momEl = document.getElementById(item.moment_id);
      if (momEl) momEl.textContent = wt > 0 ? moment.toFixed(0) : '—';
      totalWt += wt;
      totalMoment += moment;
    });

    const cg = totalWt > 0 ? totalMoment / totalWt : 0;
    const limits = totalWt > 0 ? getCgLimits(totalWt) : { forward: null, aft: null };
    document.getElementById('wb-total-wt').textContent    = totalWt > 0 ? totalWt.toFixed(1) : '—';
    document.getElementById('wb-total-moment').textContent= totalWt > 0 ? totalMoment.toFixed(2) : '—';
    document.getElementById('wb-res-wt').textContent = totalWt > 0 ? `${totalWt.toFixed(1)} lbs` : '—';
    document.getElementById('wb-res-cg').textContent = totalWt > 0 ? `${cg.toFixed(2)} in aft` : '—';
    const limitsEl = document.getElementById('wb-res-limits');
    if (limitsEl) {
      limitsEl.textContent = totalWt > 0 && limits.forward != null && limits.aft != null
        ? `${limits.forward.toFixed(2)} - ${limits.aft.toFixed(2)} in`
        : '—';
    }

    const statusEl = document.getElementById('wb-status');
    let status = '', statusClass = '';
    if (totalWt <= 0) { status = 'Enter values'; statusClass = ''; }
    else if (totalWt > WB_MAX_GWT) { status = `OVER MAX GROSS by ${(totalWt - WB_MAX_GWT).toFixed(0)} lbs`; statusClass = 'wb-bad'; }
    else if (limits.forward != null && cg < limits.forward) { status = `CG FORWARD of limit (${cg.toFixed(2)} in < ${limits.forward.toFixed(2)} in)`; statusClass = 'wb-bad'; }
    else if (limits.aft != null && cg > limits.aft) { status = `CG AFT of limit (${cg.toFixed(2)} in > ${limits.aft.toFixed(2)} in)`; statusClass = 'wb-bad'; }
    else { status = `Within limits (${(limits.forward || 0).toFixed(2)}-${(limits.aft || 0).toFixed(2)} in)`; statusClass = 'wb-good'; }
    if (statusEl) { statusEl.textContent = status; statusEl.className = 'wb-result-val wb-status ' + statusClass; }

    drawWBEnvelope(totalWt, cg);
  }

  function drawWBEnvelope(wt, cg) {
    const canvas = document.getElementById('wb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const wtMin=1200, wtMax=2200, cgMin=83, cgMax=97;
    const mx = x => Math.round((x-cgMin)/(cgMax-cgMin)*(W-50)+25);
    const my = y => Math.round((1-(y-wtMin)/(wtMax-wtMin))*(H-40)+20);
    const polygon = [
      ...WB_REFERENCE.envelope.forward.map(([weight, limitCg]) => [limitCg, weight]),
      ...WB_REFERENCE.envelope.aft.slice().reverse().map(([weight, limitCg]) => [limitCg, weight]),
    ];

    // Draw envelope fill
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? 'rgba(22,163,74,.18)' : 'rgba(22,163,74,.12)';
    ctx.beginPath();
    polygon.forEach(([limitCg, weight], index) => {
      if (index === 0) ctx.moveTo(mx(limitCg), my(weight));
      else ctx.lineTo(mx(limitCg), my(weight));
    });
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
    [84, 86, 88, 90, 92, 94, 95.9].forEach(cg => {
      const x = mx(cg);
      ctx.beginPath(); ctx.moveTo(x, H-20); ctx.lineTo(x, H-15); ctx.stroke();
      ctx.fillText(cg, x, H-8);
    });
    ctx.textAlign = 'right';
    [1200, 1650, 1975, 2150].forEach(w => {
      const y = my(w);
      ctx.beginPath(); ctx.moveTo(25, y); ctx.lineTo(30, y); ctx.stroke();
      ctx.fillText(w, 23, y+3);
    });

    // Plot the current CG point
    if (wt > 0 && cg > 0) {
      const px = mx(cg), py = my(wt);
      const limits = getCgLimits(wt);
      const inEnv = wt <= WB_MAX_GWT && limits.forward != null && limits.aft != null && cg >= limits.forward && cg <= limits.aft;
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
      <div class="perf-disclaimer">⚠ Aircraft-data estimate only. Verify with your current POH / ForeFlight reference and apply a minimum 50% safety margin.</div>`;
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
      <div class="perf-disclaimer">⚠ Aircraft-data estimate only. Technique, obstacle clearance, and brake condition significantly affect actual landing distance. Verify against current POH / ForeFlight data and apply a minimum 50% safety margin.</div>`;
  });
}

window.dispatchEvent(new Event('cfi:tools-ready'));

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
  CFIApp.setActiveStudent(selectEl.value);
  activeId = CFIApp.state.activeId;
  CFIApp.refreshStudentContext();
});

CFIApp.register('tools', {
  init() {},
  bindEvents() {},
  renderStandards() {
    renderStandards();
  },
  renderTools() {
    initFlightTools();
  },
  refreshForStudent() {
    rebuildSelect();
  },
  rebuildStudentSelect() {
    rebuildSelect();
  },
});

// Add student modal
const addModal = document.getElementById('modal-add');
document.getElementById('btn-add-student').addEventListener('click', () => { document.getElementById('new-student-name').value = ''; addModal.classList.add('open'); setTimeout(()=>document.getElementById('new-student-name').focus(),100); });
addModal.querySelector('.modal-close').addEventListener('click', () => addModal.classList.remove('open'));
addModal.addEventListener('click', e => { if(e.target===addModal) addModal.classList.remove('open'); });
document.getElementById('btn-add-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-student-name').value.trim();
  if (!name) {
    CFIApp.notify?.('Enter a student name to continue.', { tone: 'error' });
    return;
  }
  const s = { id: mkId(), name };
  students.push(s);
  saveStudents(students);
  CFIApp.setStudents(students);
  CFIApp.setActiveStudent(s.id);
  activeId = CFIApp.state.activeId;
  rebuildSelect();
  CFIApp.refreshStudentContext();
  addModal.classList.remove('open');
  CFIApp.notify?.(`Student "${name}" added and selected.`, { tone: 'success' });
  CFIApp.evaluateStartupNotices?.();
  CFIApp.refreshSettingsMeta?.();
});
document.getElementById('new-student-name').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-add-confirm').click(); });

// ── Feature 2: Student Profile Modal ───────────────────────────
const manageModal  = document.getElementById('modal-manage');
const profileModal = document.getElementById('modal-profile');
let profileSid = null;
