(function() {
  const state = {
    students: getStudents(),
    activeId: getActiveId(),
    currentView: 'home',
    checklistKeys: [],
  };

  const eventContracts = {
    'student-change': {
      payload: ['activeId', 'previousActiveId', 'currentView'],
      firesWhen: 'The active student changes.',
      legacy: false,
    },
    'view-change': {
      payload: ['view', 'previousView', 'activeId'],
      firesWhen: 'The active top-level view changes.',
      legacy: false,
    },
    'flights-changed': {
      payload: ['activeId', 'count', 'reason'],
      firesWhen: 'Flight log data changes for the active student.',
      legacy: false,
    },
    'dashboard-data-changed': {
      payload: ['activeId', 'source'],
      firesWhen: 'Dashboard-relevant student data changes outside the flight log.',
      legacy: false,
    },
    'refresh-all': {
      payload: ['activeId', 'currentView', 'reason'],
      firesWhen: 'A full shell refresh has been requested.',
      legacy: false,
    },
    'student-context-refresh': {
      payload: ['activeId', 'currentView', 'reason'],
      firesWhen: 'The shell has refreshed student-scoped modules.',
      legacy: true,
    },
    'visit-tracked': {
      payload: ['activeId', 'lessonId'],
      firesWhen: 'A lesson visit is recorded.',
      legacy: false,
    },
  };

  const modules = {};
  const dom = {
    darkBtn: document.getElementById('btn-dark'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('sidebar-overlay'),
    hamburger: document.getElementById('hamburger'),
    dashViewAllFlights: document.getElementById('dash-view-all-flights'),
    backToTop: document.getElementById('btn-top'),
    main: document.getElementById('main'),
    feedbackHost: null,
    notice: null,
    noticeText: null,
    noticeActions: null,
    toastStack: null,
    views: {
      home: document.getElementById('home'),
      endorsements: document.getElementById('endorsements'),
      flightlog: document.getElementById('flight-log-full'),
      history: document.getElementById('session-history'),
      quiz: document.getElementById('pre-solo-quiz'),
      standards: document.getElementById('standards'),
      tools: document.getElementById('flight-tools'),
      lessons: document.getElementById('lessons-content'),
    },
  };

  function getModule(name) {
    return modules[name] || null;
  }

  function ensureFeedbackUi() {
    if (dom.feedbackHost) return;
    const host = document.createElement('div');
    host.id = 'app-feedback-host';
    host.innerHTML = `
      <div id="app-global-notice" class="app-global-notice" hidden>
        <div class="app-global-notice-text" id="app-global-notice-text"></div>
        <div class="app-global-notice-actions" id="app-global-notice-actions"></div>
      </div>
      <div id="app-toast-stack" class="app-toast-stack" aria-live="polite" aria-atomic="true"></div>
    `;
    document.body.appendChild(host);
    dom.feedbackHost = host;
    dom.notice = host.querySelector('#app-global-notice');
    dom.noticeText = host.querySelector('#app-global-notice-text');
    dom.noticeActions = host.querySelector('#app-global-notice-actions');
    dom.toastStack = host.querySelector('#app-toast-stack');
  }

  function notify(message, options = {}) {
    ensureFeedbackUi();
    if (!message || !dom.toastStack) return;
    const tone = options.tone || 'info';
    const toast = document.createElement('div');
    toast.className = `app-toast ${tone}`;
    toast.innerHTML = `
      <div class="app-toast-message">${message}</div>
      <button class="app-toast-close" type="button" aria-label="Dismiss notification">×</button>
    `;
    dom.toastStack.appendChild(toast);
    const remove = () => toast.remove();
    toast.querySelector('.app-toast-close')?.addEventListener('click', remove);
    setTimeout(remove, options.duration || 2800);
  }

  function showNotice(message, actions = []) {
    ensureFeedbackUi();
    if (!dom.notice || !dom.noticeText || !dom.noticeActions) return;
    dom.notice.hidden = false;
    dom.noticeText.textContent = message || '';
    dom.noticeActions.innerHTML = '';
    actions.forEach(action => {
      const btn = document.createElement(action.href ? 'a' : 'button');
      btn.className = 'app-notice-btn';
      btn.textContent = action.label || 'Open';
      if (action.href) {
        btn.href = action.href;
        btn.target = action.target || '_blank';
        btn.rel = 'noreferrer';
      } else {
        btn.type = 'button';
        btn.addEventListener('click', () => action.onClick?.());
      }
      dom.noticeActions.appendChild(btn);
    });
  }

  function hideNotice() {
    if (!dom.notice || !dom.noticeActions) return;
    dom.notice.hidden = true;
    dom.noticeActions.innerHTML = '';
  }

  function setBusyButton(buttonOrId, busy, busyText, idleText) {
    const btn = typeof buttonOrId === 'string' ? document.getElementById(buttonOrId) : buttonOrId;
    if (!btn) return;
    if (!btn.dataset.idleText) btn.dataset.idleText = idleText || btn.textContent || '';
    btn.disabled = !!busy;
    btn.textContent = busy ? (busyText || 'Working...') : (idleText || btn.dataset.idleText);
  }

  function evaluateStartupNotices() {
    const issues = CFIData.meta.getHealthIssues?.() || [];
    if (issues.length) {
      showNotice('Some saved data was repaired on load. Review your students and restore from backup if anything looks off.', [
        { label: 'Open Settings', onClick: () => document.getElementById('btn-settings')?.click() },
        { label: 'User Guide', href: 'user-guide.html' },
      ]);
      return;
    }
    if (CFIData.settings.shouldRemindBackup?.()) {
      showNotice('Your training records should be backed up soon. Export a backup to keep a recoverable copy.', [
        { label: 'Export Backup', onClick: () => document.getElementById('settings-backup-btn')?.click() },
        { label: 'Dismiss', onClick: () => { CFIData.settings.dismissBackupReminder?.(); hideNotice(); } },
      ]);
      return;
    }
    const students = getStudents();
    const isFirstRun = students.length === 1 && students[0]?.name === 'Student 1' && (CFIData.analytics.get?.().appOpens || 0) <= 1;
    if (isFirstRun) {
      showNotice('Welcome. Start by adding your first student, then open lessons or log a flight to populate the dashboard.', [
        { label: 'Add Student', onClick: () => document.getElementById('btn-add-student')?.click() },
        { label: 'Quick Guide', href: 'user-guide.html' },
        { label: 'Dismiss', onClick: () => hideNotice() },
      ]);
      return;
    }
    hideNotice();
  }

  function refreshSettingsMeta() {
    const settingsPop = document.getElementById('settings-popover');
    if (!settingsPop) return;
    let meta = document.getElementById('settings-meta-panel');
    if (!meta) {
      meta = document.createElement('div');
      meta.id = 'settings-meta-panel';
      meta.style.padding = '0 12px 12px';
      meta.style.display = 'grid';
      meta.style.gap = '.5rem';
      settingsPop.appendChild(meta);
    }
    const analytics = CFIData.analytics.get?.() || {};
    const backupText = analytics.lastBackupAt ? new Date(analytics.lastBackupAt).toLocaleString() : 'No manual backup yet';
    const guideLink = `<a href="user-guide.html" target="_blank" rel="noreferrer" class="settings-link-btn">Open User Guide</a>`;
    meta.innerHTML = `
      <div style="font-size:.76rem;color:var(--text-muted);line-height:1.45">
        Opens: <strong>${analytics.appOpens || 0}</strong> · Lesson completions: <strong>${analytics.lessonCompletions || 0}</strong> · Flights logged: <strong>${(analytics.flightAdds || 0) + (analytics.flightEdits || 0)}</strong>
      </div>
      <div style="font-size:.76rem;color:var(--text-muted);line-height:1.45">
        Last backup: <strong>${backupText}</strong>
      </div>
      ${guideLink}
    `;
  }

  function normalizeEventDetail(eventName, detail) {
    const base = Object.assign({
      activeId: state.activeId,
      currentView: state.currentView,
    }, detail || {});

    if (eventName === 'student-change') {
      return {
        activeId: base.activeId,
        previousActiveId: base.previousActiveId || null,
        currentView: base.currentView,
      };
    }
    if (eventName === 'view-change') {
      return {
        view: base.view || state.currentView,
        previousView: base.previousView || null,
        activeId: base.activeId,
      };
    }
    if (eventName === 'flights-changed') {
      return {
        activeId: base.activeId,
        count: Number.isFinite(base.count) ? base.count : 0,
        reason: base.reason || 'updated',
      };
    }
    if (eventName === 'dashboard-data-changed') {
      return {
        activeId: base.activeId,
        source: base.source || 'unknown',
      };
    }
    if (eventName === 'refresh-all' || eventName === 'student-context-refresh') {
      return {
        activeId: base.activeId,
        currentView: base.currentView,
        reason: base.reason || 'manual',
      };
    }
    if (eventName === 'visit-tracked') {
      return {
        activeId: base.activeId,
        lessonId: base.lessonId || '',
      };
    }
    return base;
  }

  function emit(eventName, detail) {
    if (!eventContracts[eventName]) {
      console.warn(`CFIApp emitted unregistered event "${eventName}".`);
    }
    document.dispatchEvent(new CustomEvent(`cfi:${eventName}`, {
      detail: normalizeEventDetail(eventName, detail),
    }));
  }

  function on(eventName, handler) {
    if (typeof handler !== 'function') return function noop() {};
    const wrapped = event => handler(event.detail || {}, event);
    document.addEventListener(`cfi:${eventName}`, wrapped);
    return function unsubscribe() {
      document.removeEventListener(`cfi:${eventName}`, wrapped);
    };
  }

  function register(name, api) {
    modules[name] = Object.assign(modules[name] || {}, api || {});
    return modules[name];
  }

  function refreshStudents() {
    state.students = getStudents();
    window.students = state.students;
    if (!state.students.some(s => s.id === state.activeId)) {
      state.activeId = state.students[0]?.id || 's1';
      setActiveId(state.activeId);
    }
  }

  function setStudents(students) {
    state.students = Array.isArray(students) && students.length ? students : getStudents();
    window.students = state.students;
    return state.students;
  }

  function setActiveStudent(id, options = {}) {
    const nextId = id || getActiveId();
    const previousActiveId = state.activeId;
    if (nextId === previousActiveId && !options.forceEmit) return state.activeId;
    state.activeId = nextId;
    window.activeId = state.activeId;
    if (!options.skipPersist) setActiveId(state.activeId);
    emit('student-change', {
      activeId: state.activeId,
      previousActiveId,
      currentView: state.currentView,
    });
    return state.activeId;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = theme === 'dark' ? '☀' : '☾';
    if (dom.darkBtn) dom.darkBtn.textContent = icon;
    const settingsDarkBtn = document.getElementById('settings-dark-btn');
    if (settingsDarkBtn) settingsDarkBtn.textContent = `${icon} Toggle Dark Mode`;
    CFIData.settings.setTheme(theme);
  }

  function openSidebar() {
    dom.sidebar?.classList.add('open');
    dom.overlay?.classList.add('active');
  }

  function closeSidebar() {
    dom.sidebar?.classList.remove('open');
    dom.overlay?.classList.remove('active');
  }

  function renderView(name) {
    const renderers = {
      home: () => getModule('dashboard')?.render?.(),
      endorsements: () => getModule('endorsements')?.render?.(),
      flightlog: () => getModule('flights')?.render?.(),
      history: () => getModule('dashboard')?.renderHistory?.(),
      quiz: () => getModule('dashboard')?.renderQuiz?.(),
      standards: () => getModule('tools')?.renderStandards?.(),
      tools: () => getModule('tools')?.renderTools?.(),
      lessons: () => getModule('lessons')?.render?.(),
    };
    renderers[name]?.();
  }

  function normalizeInitialViewState() {
    const requestedView = document.querySelector('.nav-special-link.active')?.dataset.view;
    const activeEntry = Object.entries(dom.views).find(([, el]) => el?.classList.contains('active-view'));
    const nextView = requestedView || activeEntry?.[0] || state.currentView || 'home';
    state.currentView = dom.views[nextView] ? nextView : 'home';
    Object.entries(dom.views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden-view', key !== state.currentView);
      el.classList.toggle('active-view', key === state.currentView);
    });
    document.querySelectorAll('.nav-special-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === state.currentView);
    });
  }

  function switchView(name) {
    if (!name || state.currentView === name) return;
    const previousView = state.currentView;
    state.currentView = name;
    window.CFIData?.raw?.hideAutosave?.();
    hideNotice();
    Object.entries(dom.views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden-view', key !== name);
      el.classList.toggle('active-view', key === name);
    });
    document.querySelectorAll('.nav-special-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === name);
    });
    renderView(name);
    dom.main?.scrollTo({ top: 0, behavior: 'smooth' });
    emit('view-change', {
      view: name,
      previousView,
      activeId: state.activeId,
    });
  }

  function refreshStudentContext(options = {}) {
    refreshStudents();
    window.activeId = state.activeId;
    getModule('students')?.refresh?.();
    getModule('lessons')?.refresh?.();
    getModule('dashboard')?.refresh?.();
    getModule('flights')?.refresh?.();
    getModule('endorsements')?.refresh?.();
    getModule('tools')?.refreshForStudent?.();
    emit('student-context-refresh', {
      activeId: state.activeId,
      currentView: state.currentView,
      reason: options.reason || 'manual',
    });
  }

  function refreshAll(reason) {
    refreshStudentContext({ reason: reason || 'manual' });
    renderView(state.currentView);
    emit('refresh-all', {
      activeId: state.activeId,
      currentView: state.currentView,
      reason: reason || 'manual',
    });
  }

  function notifyFlightsChanged(detail = {}) {
    emit('flights-changed', Object.assign({
      activeId: state.activeId,
      count: getModule('flights')?.getSortedFlights?.().length || 0,
      reason: 'updated',
    }, detail));
  }

  function notifyDashboardDataChanged(source, detail = {}) {
    emit('dashboard-data-changed', Object.assign({
      activeId: state.activeId,
      source: source || 'unknown',
    }, detail));
  }

  function notifyVisitTracked(detail = {}) {
    emit('visit-tracked', Object.assign({
      activeId: state.activeId,
      lessonId: '',
    }, detail));
  }

  function getOpenModal() {
    const modals = [...document.querySelectorAll('.modal-overlay.open')];
    return modals.length ? modals[modals.length - 1] : null;
  }

  function closeOpenModal() {
    const modal = getOpenModal();
    if (!modal) return false;
    modal.classList.remove('open');
    window.CFIData?.raw?.hideAutosave?.();
    return true;
  }

  function initShell() {
    window.activeId = state.activeId;
    window.students = state.students;
    normalizeInitialViewState();
    state.checklistKeys = [...document.querySelectorAll('[data-ckey]')]
      .map(node => node.dataset.ckey)
      .filter(Boolean);
    ensureFeedbackUi();
    applyTheme(CFIData.settings.getTheme());
    CFIData.analytics.logEvent?.('app-open', { view: state.currentView });
    evaluateStartupNotices();

    dom.darkBtn?.addEventListener('click', () => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      notify(`Theme changed to ${nextTheme} mode.`, { tone: 'info' });
    });
    dom.hamburger?.addEventListener('click', () => {
      dom.sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    dom.overlay?.addEventListener('click', closeSidebar);
    dom.dashViewAllFlights?.addEventListener('click', event => {
      event.preventDefault();
      switchView('flightlog');
    });
    dom.backToTop?.addEventListener('click', () => {
      dom.main?.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.querySelectorAll('.nav-special-link').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        switchView(link.dataset.view);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
    document.querySelectorAll('[data-action="manage-students"]').forEach(button => {
      button.addEventListener('click', () => {
        window.setTimeout(() => document.getElementById('btn-manage-student')?.click(), 0);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
    document.querySelectorAll('[data-action="open-settings"]').forEach(button => {
      button.addEventListener('click', () => {
        window.setTimeout(() => document.getElementById('btn-settings')?.click(), 0);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (closeOpenModal()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    refreshSettingsMeta();

    window.addEventListener('error', event => {
      if (!event?.message) return;
      notify('Something went wrong. Your last saved data is still stored locally.', { tone: 'error', duration: 4200 });
    });
  }

  window.CFIApp = {
    state,
    dom,
    modules,
    register,
    getModule,
    emit,
    on,
    eventContracts,
    setStudents,
    setActiveStudent,
    switchView,
    openSidebar,
    closeSidebar,
    applyTheme,
    refreshStudentContext,
    refreshAll,
    notifyFlightsChanged,
    notifyDashboardDataChanged,
    notifyVisitTracked,
    closeOpenModal,
    notify,
    showNotice,
    hideNotice,
    setBusyButton,
    evaluateStartupNotices,
    refreshSettingsMeta,
    initShell,
  };
})();
