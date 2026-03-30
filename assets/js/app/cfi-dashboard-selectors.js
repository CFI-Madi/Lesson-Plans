(function() {
  const FAR_REQS = [
    { key:'total', label:'Total Flight Time', req:40, unit:'hr', fn: f => parseFloat(f.flightTime || 0) },
    { key:'dual', label:'Dual Instruction', req:20, unit:'hr', fn: f => f.dual ? parseFloat(f.flightTime || 0) : 0 },
    { key:'solo', label:'Solo Flight Time', req:10, unit:'hr', fn: f => f.solo ? parseFloat(f.flightTime || 0) : 0 },
    { key:'xc_dual', label:'Cross-Country (Dual)', req:3, unit:'hr', fn: f => (f.dual && f.xc) ? parseFloat(f.flightTime || 0) : 0 },
    { key:'night', label:'Night (Dual)', req:3, unit:'hr', fn: f => (f.dual && f.night) ? parseFloat(f.flightTime || 0) : 0 },
    { key:'night_xc', label:'Night XC >50 NM', req:1, unit:'flight', fn: f => (f.dual && f.night && f.xc) ? 1 : 0 },
    { key:'night_tos', label:'Night T&Ls at Towered Arpt', req:10, unit:'landings', fn: f => (f.night && f.nightTos) ? parseInt(f.landings || 0, 10) : 0 },
    { key:'sim', label:'Instrument Reference (Dual)', req:3, unit:'hr', fn: f => (f.dual && f.sim) ? parseFloat(f.flightTime || 0) : 0 },
    { key:'solo_xc', label:'Solo XC >150 NM', req:1, unit:'flight', fn: f => (f.solo && f.xc) ? 1 : 0 },
    { key:'prep', label:'Pre-checkride Dual (60 days)', req:3, unit:'hr', fn: (f, cutoff) => {
      if (!f.dual || !cutoff) return 0;
      const d = new Date(f.date);
      const c = new Date(cutoff);
      return d >= c ? parseFloat(f.flightTime || 0) : 0;
    }},
  ];

  const MILESTONES = [
    { key: 'first-solo', label: 'First Solo', icon: '\u2708', needsExaminer: false },
    { key: 'presolo-stage', label: 'Pre-Solo Stage Check', icon: '\ud83d\udccb', needsExaminer: true },
    { key: 'prexc-stage', label: 'Pre-XC Stage Check', icon: '\ud83d\uddfa', needsExaminer: true },
    { key: 'mock-oral', label: 'Mock Oral Exam', icon: '\ud83c\udf93', needsExaminer: true },
    { key: 'mock-checkride', label: 'Mock Checkride', icon: '\ud83c\udfaf', needsExaminer: true },
  ];

  const PAR_SUBJECTS = [
    'Pilot Qualifications',
    'Airspace Classification & Operating Requirements',
    'Flight Instruments',
    'Aviation Weather / Services',
    'Performance & Limitations',
    'Navigation & Charts',
    'FAR / AIM Regulations',
    'Radio Communications & ATC Procedures',
    'Emergency Procedures',
    'Aerodynamics & Aircraft Systems',
  ];

  const MIN_FIELDS = [
    { id:'min-xwind', label:'Max Crosswind', unit:'kts', key:'xwind' },
    { id:'min-ceiling', label:'Min Ceiling VFR', unit:'ft AGL', key:'ceiling' },
    { id:'min-vis', label:'Min Visibility VFR', unit:'SM', key:'vis' },
    { id:'min-xc-wind', label:'Max Demo XC Wind', unit:'kts', key:'xcwind' },
    { id:'min-night-ldg', label:'Night Currency (90 days)', unit:'ldgs', key:'nightldg' },
    { id:'min-solo-hrs', label:'Solo Hrs Before XC', unit:'hrs', key:'soloHrs' },
    { id:'min-notes', label:'Notes', unit:'', key:'notes' },
  ];

  const COMP_COLORS = ['#9399a8', '#3b82f6', '#f59e0b', '#16a34a', '#0f5132'];
  const memo = {
    flightsDesc: { key: '', value: [] },
    flightsAsc: { key: '', value: [] },
    acsTrend: { key: '', value: [] },
  };

  function getActiveStudentId() {
    return window.CFIApp?.state?.activeId || window.activeId || '';
  }

  function getScopedStorageKey(type, key) {
    return `${getActiveStudentId()}|${type}|${key}`;
  }

  function getRawScopedValue(type, key, fallback) {
    const value = window.CFIData?.raw?.safeGet?.(getScopedStorageKey(type, key));
    return value == null ? (fallback || '') : value;
  }

  function getStudentsList() {
    return Array.isArray(window.getStudents?.()) ? window.getStudents() : [];
  }

  function getActiveStudent() {
    const activeId = window.CFIApp?.state?.activeId || window.activeId;
    const students = getStudentsList();
    return students.find(student => student.id === activeId) || students[0] || null;
  }

  function getSortedFlightsDesc() {
    const cacheKey = `${getActiveStudentId()}|${getRawScopedValue('flights', 'all', '[]')}`;
    if (memo.flightsDesc.key === cacheKey) return memo.flightsDesc.value.slice();
    const sorted = (window.getFlights?.() || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    memo.flightsDesc = { key: cacheKey, value: sorted };
    return sorted.slice();
  }

  function getSortedFlightsAsc() {
    const cacheKey = `${getActiveStudentId()}|${getRawScopedValue('flights', 'all', '[]')}`;
    if (memo.flightsAsc.key === cacheKey) return memo.flightsAsc.value.slice();
    const sorted = (window.getFlights?.() || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    memo.flightsAsc = { key: cacheKey, value: sorted };
    return sorted.slice();
  }

  function getLessonStats() {
    const ids = window.ALL_LESSON_IDS || [];
    const signoffs = ids.filter(id => window.getComp(id) >= 4).length;
    const lessonsStarted = ids.filter(id => window.getComp(id) >= 1).length;
    return { signoffs, lessonsStarted, totalLessons: ids.length };
  }

  function getChecklistKeys() {
    return Array.isArray(window.CFIApp?.state?.checklistKeys) ? window.CFIApp.state.checklistKeys : [];
  }

  function getChecklistProgress() {
    const keys = getChecklistKeys();
    const total = keys.length;
    const done = keys.filter(key => window.CFIData?.lessonProgress?.getChecklistValue?.(key)).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return { total, done, pct };
  }

  function getFlightTotals(flights) {
    const totalTime = flights.reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    const totalDual = flights.filter(flight => flight.dual).reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    const totalSolo = flights.filter(flight => flight.solo).reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    return { totalTime, totalDual, totalSolo };
  }

  function getHoursTotals(flights) {
    const cutoff60 = (() => {
      const date = new Date();
      date.setDate(date.getDate() - 60);
      return date.toISOString().split('T')[0];
    })();
    const totals = {};
    FAR_REQS.forEach(req => {
      totals[req.key] = flights.reduce((sum, flight) => sum + (req.key === 'prep' ? req.fn(flight, cutoff60) : req.fn(flight)), 0);
    });
    return totals;
  }

  function getHoursRequirementCards() {
    const flights = getSortedFlightsDesc();
    const totals = getHoursTotals(flights);
    return FAR_REQS.map(req => {
      const have = totals[req.key];
      const pct = Math.min(100, Math.round((have / req.req) * 100));
      const met = have >= req.req;
      const remain = met ? 0 : +(req.req - have).toFixed(1);
      return {
        key: req.key,
        label: req.label,
        unit: req.unit,
        req: req.req,
        have,
        pct,
        met,
        remain,
      };
    });
  }

  function getNextLessonRecommendation() {
    const lessons = window.ALL_LESSONS || [];
    const next = lessons.find(lesson => window.getComp(lesson.id) < 3);
    if (!next) return null;
    const level = window.getComp(next.id);
    return {
      id: next.id,
      code: next.code,
      title: next.title,
      level,
      label: (window.COMP_LABELS || [])[level] || '',
      color: COMP_COLORS[level] || COMP_COLORS[0],
    };
  }

  function getRecentFlights(limit) {
    return getSortedFlightsDesc().slice(0, limit || 3).map(flight => ({
      ...flight,
      shortGrade: (window.GRADE_SHORT || ['', 'Intro', 'Demo', 'Prac', 'Sat'])[flight.grade || 0] || '',
      tags: [
        flight.dual ? 'D' : null,
        flight.solo ? 'S' : null,
        flight.night ? 'N' : null,
        flight.xc ? 'XC' : null,
        flight.sim ? 'IR' : null,
        flight.nightTos ? 'NT' : null,
      ].filter(Boolean),
    }));
  }

  function getRecentVisitsDetailed() {
    const visits = window.getVisits?.() || [];
    return visits.map(id => {
      const lesson = (window.ALL_LESSONS || []).find(item => item.id === id);
      if (!lesson) return null;
      return { id, code: lesson.code, title: lesson.title };
    }).filter(Boolean);
  }

  function getReadinessOverview() {
    const flights = getSortedFlightsDesc();
    const totals = getHoursTotals(flights);
    const lessonStats = getLessonStats();
    const endorsementsOk = ['A1','A2','A3','A4','A6','A9','A36','A37']
      .every(id => window.CFIData?.endorsements?.getDone?.(id));
    const hoursOk = FAR_REQS.every(req => totals[req.key] >= req.req);
    const ktest = window.getKtest?.() || {};
    const kTestOk = !!(ktest.date && ktest.score >= 70);
    const milestoneData = window.getMilestones?.() || {};
    const milestonesOk = MILESTONES.every(milestone => {
      const entry = milestoneData[milestone.key] || {};
      return entry.date && entry.passed !== false;
    });
    const signoffTarget = Math.floor((window.ALL_LESSON_IDS || []).length * 0.8);
    const lessonsOk = lessonStats.signoffs >= signoffTarget;
    const checks = [
      { label:'14 CFR 61.109 Hour Requirements', ok: hoursOk, hint: hoursOk ? 'All met' : 'See hour tracker below' },
      { label:'Key Endorsements (AC 61-65K)', ok: endorsementsOk, hint: endorsementsOk ? 'Required endorsements complete' : 'Open Endorsements tab' },
      { label:'Lessons >=80% Signed Off', ok: lessonsOk, hint: `${lessonStats.signoffs}/${lessonStats.totalLessons} signed off` },
      { label:'Knowledge Test Passed (PAR)', ok: kTestOk, hint: kTestOk ? `${ktest.score}% on ${ktest.date}` : 'Record test above' },
      { label:'Training Milestones Complete', ok: milestonesOk, hint: milestonesOk ? 'All milestones passed' : 'Record milestones above' },
    ];
    const totalOk = checks.filter(check => check.ok).length;
    const allOk = totalOk === checks.length;
    return {
      checks,
      totalOk,
      allOk,
      badgeText: allOk ? '\u2713 Ready' : `${totalOk}/${checks.length}`,
      badgeClass: allOk ? 'green' : totalOk >= 3 ? 'amber' : 'red',
    };
  }

  function getSoloCurrencyStatus() {
    const a6date = window.CFIData?.endorsements?.getDate?.('A6') || '';
    const a7date = window.CFIData?.endorsements?.getDate?.('A7') || '';
    const latestSolo = [a6date, a7date].filter(Boolean).sort().pop();
    if (!latestSolo) return { visible: false };
    const expiration = new Date(latestSolo);
    expiration.setDate(expiration.getDate() + 90);
    const daysLeft = Math.ceil((expiration - new Date()) / 86400000);
    if (daysLeft > 14) return { visible: false };
    return daysLeft <= 0 ? {
      visible: true,
      className: 'expired',
      text: 'Solo endorsement EXPIRED',
      detail: 'Student cannot fly solo until re-endorsed.',
    } : {
      visible: true,
      className: 'warning',
      text: `Solo endorsement expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      detail: 'Re-endorse before the next solo flight.',
    };
  }

  function getTimelineBars() {
    const flights = getSortedFlightsAsc();
    if (!flights.length) return { items: [], totalFlights: 0, totalHours: 0 };
    const grouped = {};
    flights.forEach(flight => {
      const month = (flight.date || '').slice(0, 7);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(flight);
    });
    const months = Object.keys(grouped).sort();
    const maxPerMonth = Math.max(...months.map(month => grouped[month].length));
    const totalHours = flights.reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    return {
      items: months.map(month => {
        const monthFlights = grouped[month];
        const hours = monthFlights.reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
        return {
          month,
          label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          flights: monthFlights.length,
          hours,
          barHeight: maxPerMonth ? Math.round((monthFlights.length / maxPerMonth) * 60) + 20 : 20,
        };
      }),
      totalFlights: flights.length,
      totalHours,
    };
  }

  function getMilestoneCards() {
    const data = window.getMilestones?.() || {};
    return MILESTONES.map(milestone => {
      const entry = data[milestone.key] || {};
      const done = !!(entry.date && entry.passed !== false);
      const passed = entry.passed !== false;
      return {
        ...milestone,
        date: entry.date || '',
        examiner: entry.examiner || '',
        conditions: entry.conditions || '',
        done,
        passed,
        statusClass: done ? (passed ? 'ms-pass' : 'ms-fail') : 'ms-pending',
      };
    });
  }

  function getKnowledgeTestModel() {
    const data = window.getKtest?.() || {};
    const deficiencies = Array.isArray(data.deficiencies) ? data.deficiencies : [];
    return {
      date: data.date || '',
      score: data.score || 0,
      deficiencies,
      passed: !!(data.date && data.score >= 70),
      subjects: PAR_SUBJECTS,
    };
  }

  function getMinimumsModel() {
    const data = window.getMins?.() || {};
    const chips = MIN_FIELDS.filter(field => field.key !== 'notes' && data[field.key]).map(field => ({
      key: field.key,
      label: field.label,
      value: data[field.key],
      unit: field.unit,
    }));
    return {
      data,
      fields: MIN_FIELDS,
      chips,
      notes: data.notes || '',
      hasAny: chips.length > 0 || !!data.notes,
    };
  }

  function getAcsTrendModel() {
    const cacheKey = `${getActiveStudentId()}|${getRawScopedValue('flights', 'all', '[]')}`;
    if (memo.acsTrend.key === cacheKey) {
      return memo.acsTrend.value.map(task => ({
        ...task,
        history: task.history.slice(),
      }));
    }
    const flights = window.getFlights?.() || [];
    const taskStats = {};
    flights.forEach(flight => {
      if (!flight.acsTasks || typeof flight.acsTasks !== 'object') return;
      Object.entries(flight.acsTasks).forEach(([code, value]) => {
        if (!taskStats[code]) {
          let name = code;
          for (const lesson of (window.ALL_LESSONS || [])) {
            const task = (lesson.acsTasks || []).find(item => item.code === code);
            if (task) { name = task.title; break; }
          }
          taskStats[code] = { code, name, S: 0, U: 0, N: 0, sessions: 0, last: '', history: [] };
        }
        const stats = taskStats[code];
        if (value === 'S') stats.S++;
        else if (value === 'U') stats.U++;
        else stats.N++;
        stats.sessions++;
        if (!stats.last || flight.date > stats.last) stats.last = flight.date;
        stats.history.push({
          date: flight.date,
          value,
          aircraft: flight.aircraft || '',
          lessonTitle: flight.lessonTitle || '',
        });
      });
    });
    const trendModel = Object.values(taskStats).sort((a, b) => {
      const aPriority = a.U / (a.sessions || 1);
      const bPriority = b.U / (b.sessions || 1);
      return bPriority - aPriority || a.code.localeCompare(b.code);
    }).map(task => {
      const total = task.S + task.U;
      const pctS = total ? Math.round((task.S / total) * 100) : 0;
      const trend = task.U === 0 ? 'strong' : (task.U <= 1 || pctS >= 75) ? 'ok' : 'needs-work';
      return {
        ...task,
        pctS,
        trend,
        trendLabel: trend === 'strong' ? '\u2713 Proficient' : trend === 'ok' ? '\u2691 Improving' : '\u2715 Needs Work',
        history: task.history.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      };
    });
    memo.acsTrend = {
      key: cacheKey,
      value: trendModel,
    };
    return trendModel.map(task => ({
      ...task,
      history: task.history.slice(),
    }));
  }

  function getPaceStatus() {
    const student = getActiveStudent();
    const startDate = student?.start;
    if (!startDate) return { label: '\u2014', color: 'var(--text-muted)', title: 'Set training start date in student profile' };
    const flights = window.getFlights?.() || [];
    const lessonStats = getLessonStats();
    const totalHours = flights.reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    const startMs = new Date(startDate).getTime();
    const weeksIn = (Date.now() - startMs) / (7 * 24 * 3600 * 1000);
    if (weeksIn <= 0) return { label: '\u2014', color: 'var(--text-muted)', title: 'Training start date is in the future' };
    const expectedHoursNow = (65 / 26) * weeksIn;
    const hoursRatio = totalHours / Math.max(1, expectedHoursNow);
    const expectedLessonsNow = ((window.ALL_LESSON_IDS || []).length / 26) * weeksIn;
    const lessonRatio = lessonStats.signoffs / Math.max(1, expectedLessonsNow);
    const ratio = (hoursRatio + lessonRatio) / 2;
    let label = '\u2b07 Behind';
    let color = '#dc2626';
    if (ratio >= 1.15) {
      label = '\u2b06 Ahead';
      color = 'var(--green)';
    } else if (ratio >= 0.85) {
      label = '\u2713 On pace';
      color = 'var(--green)';
    } else if (ratio >= 0.60) {
      label = '\u2691 Slightly behind';
      color = '#d97706';
    }
    return {
      label,
      color,
      title: `${totalHours.toFixed(1)} hrs logged · ${lessonStats.signoffs} lessons signed off · ${weeksIn.toFixed(0)} weeks training`,
    };
  }

  function getStudentStatsChipModel() {
    const flights = window.getFlights?.() || [];
    const totalHours = flights.reduce((sum, flight) => sum + parseFloat(flight.flightTime || 0), 0);
    const lessonStats = getLessonStats();
    const readiness = getReadinessOverview();
    return {
      text: `${totalHours.toFixed(1)}h · ${lessonStats.signoffs}\u2713 · ${readiness.totalOk}/5`,
      title: `${totalHours.toFixed(1)} hrs logged · ${lessonStats.signoffs}/${lessonStats.totalLessons} lessons signed off · ${readiness.totalOk}/5 readiness checks`,
      color: readiness.totalOk === 5 ? 'var(--green)' : readiness.totalOk >= 3 ? '#d97706' : 'var(--text-muted)',
    };
  }

  function getProactivePrompts() {
    const flights = getSortedFlightsDesc();
    const nextLesson = getNextLessonRecommendation();
    const readiness = getReadinessOverview();
    const lessonStats = getLessonStats();
    const hasFoundationalProgress = lessonStats.lessonsStarted > 0 && flights.length > 0;
    const prompts = [];

    if (!hasFoundationalProgress) return [];

    if (flights.length) {
      const lastFlightDate = flights[0]?.date ? new Date(flights[0].date) : null;
      if (lastFlightDate && !Number.isNaN(lastFlightDate.getTime())) {
        const daysSinceLastFlight = Math.floor((Date.now() - lastFlightDate.getTime()) / 86400000);
        if (daysSinceLastFlight >= 14) {
          prompts.push({
            id: 'flight-recency',
            priority: daysSinceLastFlight >= 30 ? 100 : 90,
            tone: 'attention',
            title: 'No flight logged recently',
            body: `It has been ${daysSinceLastFlight} days since the last recorded flight. Logging the next session will keep recency and readiness accurate.`,
            action: 'log-flight',
            actionLabel: 'Log Flight',
          });
        }
      }
    }

    if (nextLesson) {
      prompts.push({
        id: 'next-lesson',
        priority: 55,
        tone: 'positive',
        title: 'Ready for the next lesson',
        body: `${nextLesson.code} ${nextLesson.title} is the clearest next step based on recent training progress.`,
        action: 'open-next-lesson',
        actionLabel: 'Open Lesson',
        lessonId: nextLesson.id,
      });
    }

    const weakTask = getAcsTrendModel().find(task => task.trend === 'needs-work') || getAcsTrendModel().find(task => task.U > 0);
    if (weakTask && flights.length) {
      prompts.push({
        id: 'weak-area',
        priority: weakTask.trend === 'needs-work' ? 80 : 65,
        tone: 'coaching',
        title: 'Focus the next session on a weak area',
        body: `${weakTask.code} ${weakTask.name} has the clearest coaching need from recent flight grading.`,
        action: 'focus-weak-area',
        actionLabel: 'Review Weak Area',
        taskCode: weakTask.code,
      });
    }

    if (readiness.totalOk >= 3 && lessonStats.signoffs >= Math.max(3, Math.floor(lessonStats.totalLessons * 0.25))) {
      prompts.push({
        id: 'solo-readiness',
        priority: readiness.totalOk >= 4 ? 70 : 60,
        tone: 'milestone',
        title: 'Approaching solo readiness',
        body: `${readiness.totalOk}/5 readiness checks are complete. Review endorsements and remaining milestones before the next stage conversation.`,
        action: 'open-endorsements',
        actionLabel: 'Review Endorsements',
      });
    }

    return prompts
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 1)
      .map(({ priority, ...prompt }) => prompt);
  }

  function getDashboardViewModel() {
    const student = getActiveStudent();
    const flights = getSortedFlightsDesc();
    const flightTotals = getFlightTotals(flights);
    const lessonStats = getLessonStats();
    const checklist = getChecklistProgress();
    const pace = getPaceStatus();
    return {
      student,
      avatar: (student?.name || 'S')[0].toUpperCase(),
      subtitle: flights.length ? `Last flight: ${flights[0]?.date || ''}` : 'No sessions logged yet',
      stats: {
        flights: flights.length,
        time: flightTotals.totalTime.toFixed(1),
        lessons: lessonStats.lessonsStarted,
        signoffs: lessonStats.signoffs,
        pace,
      },
      checklist,
      nextLesson: getNextLessonRecommendation(),
      recentFlights: getRecentFlights(3),
      recentVisits: getRecentVisitsDetailed(),
      hoursCards: getHoursRequirementCards(),
      readiness: getReadinessOverview(),
      soloCurrency: getSoloCurrencyStatus(),
      timeline: getTimelineBars(),
      milestones: getMilestoneCards(),
      knowledgeTest: getKnowledgeTestModel(),
      minimums: getMinimumsModel(),
      acsTrend: getAcsTrendModel(),
      prompts: getProactivePrompts(),
    };
  }

  const flightsSelectors = {
    getSortedFlightsDesc,
    getFlightTotals,
    getHoursTotals,
    getHoursRequirementCards,
    getRecentFlights,
    getTimelineBars,
    getAcsTrendModel,
  };

  const lessonsSelectors = {
    getChecklistProgress,
    getRecentVisitsDetailed,
    getNextLessonRecommendation,
  };

  const endorsementsSelectors = {
    getSoloCurrencyStatus,
    getKnowledgeTestModel,
    getMinimumsModel,
    getMilestoneCards,
  };

  const dashboardSelectors = {
    getReadinessOverview,
    getPaceStatus,
    getStudentStatsChipModel,
    getProactivePrompts,
    getDashboardViewModel,
  };

  window.CFISelectors = {
    flights: flightsSelectors,
    lessons: lessonsSelectors,
    endorsements: endorsementsSelectors,
    dashboard: dashboardSelectors,
  };

  window.CFIDashboardSelectors = Object.assign({
    FAR_REQS,
    MILESTONES,
    PAR_SUBJECTS,
    MIN_FIELDS,
    COMP_COLORS,
  }, flightsSelectors, lessonsSelectors, endorsementsSelectors, dashboardSelectors);
})();
