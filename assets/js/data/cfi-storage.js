(function(){
  const STORAGE_SCHEMA_KEY = 'cfi-schema-version';
  const STORAGE_SCHEMA_VERSION = 1;
  const BACKUP_SCHEMA_VERSION = 1;
  const ANALYTICS_KEY = 'cfi-analytics';
  const RECOVERY_SNAPSHOT_KEY = 'cfi-recovery-snapshot';
  const BACKUP_REMINDER_KEY = 'cfi-backup-reminder-dismissed-at';
  const healthIssues = [];

  function recordHealthIssue(message, meta) {
    if (!message) return;
    const issue = {
      message,
      meta: meta || {},
      at: new Date().toISOString(),
    };
    healthIssues.push(issue);
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function hideAutosave() {
    const ind = document.getElementById('autosave-indicator');
    if (!ind) return;
    clearTimeout(ind._t);
    ind.classList.remove('show');
    ind.setAttribute('aria-hidden', 'true');
  }

  function flashAutosave(message) {
    const ind = document.getElementById('autosave-indicator');
    if (!ind) return;
    clearTimeout(ind._t);
    ind.textContent = message || 'Saved ✓';
    ind.setAttribute('aria-hidden', 'false');
    ind.classList.remove('show');
    void ind.offsetWidth;
    ind.classList.add('show');
    ind._t = setTimeout(() => hideAutosave(), 1400);
  }

  function silentSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function flashedSet(key, value) {
    silentSet(key, value);
    flashAutosave();
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function safeParse(raw, fallback, sourceKey) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch {
      if (sourceKey) recordHealthIssue('Saved data could not be read and was repaired automatically.', { key: sourceKey });
      return fallback;
    }
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clonePlainObject(value, fallback) {
    return isPlainObject(value) ? { ...value } : fallback;
  }

  function normalizeStudents(value) {
    if (!Array.isArray(value)) {
      if (value != null) {
      recordHealthIssue('Student records were reset because saved student data was unreadable.', { key: 'cfi-students' });
      }
      return [{ id: 's1', name: 'Student 1' }];
    }
    const students = value
      .filter(student => isPlainObject(student) && typeof student.id === 'string' && student.id)
      .map(student => ({ ...student }));
    if (students.length) return students;
    recordHealthIssue('Student records were reset because saved student data was invalid.', { key: 'cfi-students' });
    return [{ id: 's1', name: 'Student 1' }];
  }

  function normalizeFlights(value) {
    if (!Array.isArray(value)) {
      if (value != null) recordHealthIssue('A flight log was reset because saved flight data was unreadable.', { type: 'flights' });
      return [];
    }
    return value.filter(flight => isPlainObject(flight)).map(flight => ({ ...flight }));
  }

  function normalizeObjectRecord(value) {
    return clonePlainObject(value, {});
  }

  function coerceStoredValue(value) {
    if (value == null) return null;
    return typeof value === 'string' ? value : String(value);
  }

  function readAllStorage() {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        data[key] = localStorage.getItem(key);
      }
    } catch {}
    return data;
  }

  function validateStorageMap(data) {
    if (!isPlainObject(data)) throw new Error('Backup payload must be an object.');
    const entries = Object.entries(data);
    entries.forEach(([key, value]) => {
      if (typeof key !== 'string' || !key) throw new Error('Backup contains an invalid key.');
      if (value !== null && typeof value !== 'string') {
        throw new Error(`Backup value for "${key}" must be a string or null.`);
      }
    });
    return Object.fromEntries(entries.map(([key, value]) => [key, coerceStoredValue(value)]));
  }

  function normalizeImportPayload(payload) {
    if (!isPlainObject(payload)) throw new Error('Backup file must contain an object payload.');
    if (isPlainObject(payload.data)) {
      return {
        schemaVersion: Number(payload.schemaVersion) || 0,
        exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : '',
        appMode: typeof payload.appMode === 'string' ? payload.appMode : 'local',
        data: validateStorageMap(payload.data),
      };
    }
    return {
      schemaVersion: 0,
      exportedAt: '',
      appMode: 'legacy',
      data: validateStorageMap(payload),
    };
  }

  function getAnalytics() {
    const base = {
      appOpens: 0,
      usageDays: {},
      usageByStudent: {},
      lessonCompletions: 0,
      flightAdds: 0,
      flightEdits: 0,
      flightDeletes: 0,
      lastBackupAt: '',
      lastRestoreAt: '',
      recentEvents: [],
    };
    const data = safeParse(safeGet(ANALYTICS_KEY), base);
    return isPlainObject(data) ? {
      ...base,
      ...data,
      usageDays: normalizeObjectRecord(data.usageDays),
      usageByStudent: normalizeObjectRecord(data.usageByStudent),
      recentEvents: Array.isArray(data.recentEvents) ? data.recentEvents.slice(0, 100) : [],
    } : base;
  }

  function saveAnalytics(data) {
    silentSet(ANALYTICS_KEY, JSON.stringify(data));
  }

  function logAnalyticsEvent(type, payload) {
    const data = getAnalytics();
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    data.recentEvents.unshift({
      type,
      at: now.toISOString(),
      studentId: activeStudentId(),
      payload: payload || {},
    });
    data.recentEvents = data.recentEvents.slice(0, 100);
    data.usageDays[dayKey] = (data.usageDays[dayKey] || 0) + (type === 'app-open' ? 1 : 0);
    if (type === 'app-open') data.appOpens += 1;
    const sid = activeStudentId();
    if (sid) data.usageByStudent[sid] = (data.usageByStudent[sid] || 0) + 1;
    if (type === 'lesson-completed') data.lessonCompletions += 1;
    if (type === 'flight-added') data.flightAdds += 1;
    if (type === 'flight-edited') data.flightEdits += 1;
    if (type === 'flight-deleted') data.flightDeletes += 1;
    saveAnalytics(data);
    return data;
  }

  function markBackupCreated() {
    const data = getAnalytics();
    data.lastBackupAt = new Date().toISOString();
    saveAnalytics(data);
    safeRemove(BACKUP_REMINDER_KEY);
  }

  function markRestoreCompleted() {
    const data = getAnalytics();
    data.lastRestoreAt = new Date().toISOString();
    saveAnalytics(data);
  }

  function captureRecoverySnapshot(reason) {
    const snapshot = {
      createdAt: new Date().toISOString(),
      reason: reason || 'manual',
      storageSchemaVersion: parseInt(safeGet(STORAGE_SCHEMA_KEY) || String(STORAGE_SCHEMA_VERSION), 10) || STORAGE_SCHEMA_VERSION,
      data: readAllStorage(),
    };
    silentSet(RECOVERY_SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  function getRecoverySnapshot() {
    const data = safeParse(safeGet(RECOVERY_SNAPSHOT_KEY), null);
    return isPlainObject(data) ? data : null;
  }

  function dismissBackupReminder() {
    silentSet(BACKUP_REMINDER_KEY, new Date().toISOString());
  }

  function shouldRemindBackup() {
    const analytics = getAnalytics();
    const lastDismissed = safeGet(BACKUP_REMINDER_KEY);
    const now = Date.now();
    const fourteenDays = 14 * 86400000;
    if (lastDismissed && now - Date.parse(lastDismissed) < 3 * 86400000) return false;
    if (!analytics.lastBackupAt) return analytics.appOpens >= 3 || analytics.flightAdds + analytics.lessonCompletions >= 3;
    const lastBackupMs = Date.parse(analytics.lastBackupAt);
    return Number.isFinite(lastBackupMs) ? (now - lastBackupMs > fourteenDays) : false;
  }

  function ensureSchemaVersion() {
    const current = parseInt(safeGet(STORAGE_SCHEMA_KEY) || '0', 10) || 0;
    if (current >= STORAGE_SCHEMA_VERSION) return current;
    const migrations = {
      1: function migrateToV1() {
        silentSet(STORAGE_SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION));
      }
    };
    for (let version = current + 1; version <= STORAGE_SCHEMA_VERSION; version++) {
      migrations[version]?.();
    }
    return STORAGE_SCHEMA_VERSION;
  }

  function studentScopedKey(studentId, type, key) {
    return `${studentId}|${type}|${key}`;
  }

  function activeStudentId() {
    return window.CFIApp?.state?.activeId || window.activeId || safeGet('cfi-active-student') || listStudents()[0]?.id || 's1';
  }

  function listStudents() {
    return normalizeStudents(safeParse(safeGet('cfi-students'), null, 'cfi-students'));
  }

  function saveStudents(students) {
    silentSet('cfi-students', JSON.stringify(normalizeStudents(students)));
  }

  function getActiveStudentId() {
    return safeGet('cfi-active-student') || listStudents()[0]?.id || 's1';
  }

  function setActiveStudentId(id) {
    silentSet('cfi-active-student', id);
  }

  function makeId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function getScoped(type, key, fallback) {
    return safeGet(studentScopedKey(activeStudentId(), type, key)) ?? fallback;
  }

  function setScoped(type, key, value) {
    flashedSet(studentScopedKey(activeStudentId(), type, key), value);
  }

  function silentSetScoped(type, key, value) {
    silentSet(studentScopedKey(activeStudentId(), type, key), value);
  }

  function listFlights() {
    return normalizeFlights(safeParse(getScoped('flights', 'all', '[]'), [], studentScopedKey(activeStudentId(), 'flights', 'all')));
  }

  function saveFlights(flights) {
    setScoped('flights', 'all', JSON.stringify(normalizeFlights(flights)));
  }

  function getCompetency(lessonId) {
    return parseInt(getScoped('comp', lessonId, '0') || '0', 10);
  }

  function setCompetency(lessonId, level) {
    setScoped('comp', lessonId, String(level));
  }

  function getCompetencyDate(lessonId) {
    return getScoped('compdate', lessonId, '') || '';
  }

  function setCompetencyDate(lessonId, date) {
    setScoped('compdate', lessonId, date);
  }

  function getLessonNote(noteKey) {
    return getScoped('note', noteKey, '') || '';
  }

  function setLessonNote(noteKey, value) {
    setScoped('note', noteKey, value);
  }

  function getChecklistValue(checkKey) {
    return getScoped('cb', checkKey, '') === '1';
  }

  function setChecklistValue(checkKey, checked) {
    setScoped('cb', checkKey, checked ? '1' : '0');
  }

  function trackVisit(lessonId) {
    const key = `${activeStudentId()}|visits`;
    let visits = safeParse(safeGet(key), []);
    visits = [lessonId, ...visits.filter(v => v !== lessonId)].slice(0, 6);
    silentSet(key, JSON.stringify(visits));
    window.CFIApp?.notifyVisitTracked?.({ activeId: activeStudentId(), lessonId });
  }

  function getVisits() {
    return safeParse(safeGet(`${activeStudentId()}|visits`), []);
  }

  function getMilestones() {
    return normalizeObjectRecord(safeParse(getScoped('milestones', 'data', '{}'), {}));
  }

  function saveMilestones(data) {
    setScoped('milestones', 'data', JSON.stringify(normalizeObjectRecord(data)));
  }

  function getKnowledgeTest() {
    return normalizeObjectRecord(safeParse(getScoped('misc', 'ktest-data', '{}'), {}));
  }

  function saveKnowledgeTest(data) {
    setScoped('misc', 'ktest-data', JSON.stringify(normalizeObjectRecord(data)));
  }

  function getMinimums() {
    return normalizeObjectRecord(safeParse(getScoped('minimums', 'data', '{}'), {}));
  }

  function saveMinimums(data) {
    setScoped('minimums', 'data', JSON.stringify(normalizeObjectRecord(data)));
  }

  function getEndorsementDone(id) {
    return getScoped('end', id + '-done', '') === '1';
  }

  function setEndorsementDone(id, done) {
    setScoped('end', id + '-done', done ? '1' : '0');
  }

  function getEndorsementDate(id) {
    return getScoped('end', id + '-date', '') || '';
  }

  function setEndorsementDate(id, value) {
    setScoped('end', id + '-date', value);
  }

  function getEndorsementNotes(id) {
    return getScoped('end', id + '-notes', '') || '';
  }

  function setEndorsementNotes(id, value) {
    setScoped('end', id + '-notes', value);
  }

  function getTheme() {
    return safeGet('cfi-theme') || 'light';
  }

  function setTheme(value) {
    silentSet('cfi-theme', value);
  }

  function exportAll() {
    ensureSchemaVersion();
    markBackupCreated();
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      storageSchemaVersion: parseInt(safeGet(STORAGE_SCHEMA_KEY) || String(STORAGE_SCHEMA_VERSION), 10) || STORAGE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appMode: window.CFIEnv?.dataMode || 'local',
      data: readAllStorage(),
    };
  }

  function describeImport(data) {
    const normalized = normalizeImportPayload(data);
    return {
      schemaVersion: normalized.schemaVersion,
      exportedAt: normalized.exportedAt,
      appMode: normalized.appMode,
      keyCount: Object.keys(normalized.data).length,
    };
  }

  function importAll(data) {
    ensureSchemaVersion();
    const normalized = normalizeImportPayload(data);
    let restored = 0;
    Object.entries(normalized.data).forEach(([key, value]) => {
      try { silentSet(key, value); restored++; } catch {}
    });
    silentSet(STORAGE_SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION));
    markRestoreCompleted();
    return restored;
  }

  function getWbLast() {
    return safeParse(safeGet('wb-last-values'), {});
  }

  function setWbLast(values) {
    silentSet('wb-last-values', JSON.stringify(values));
  }

  function getNavOrder() {
    return safeParse(safeGet('nav-group-order'), null);
  }

  function setNavOrder(order) {
    silentSet('nav-group-order', JSON.stringify(order));
  }

  function clearNavOrder() {
    safeRemove('nav-group-order');
  }

  function normalizeVspeeds(data, defaults) {
    const base = isPlainObject(defaults) ? defaults : {};
    const source = isPlainObject(data) ? data : {};
    const baseSpeeds = Array.isArray(base.speeds) ? base.speeds : [];
    const sourceSpeeds = Array.isArray(source.speeds) ? source.speeds : [];
    return {
      ...base,
      ...source,
      aircraft: typeof source.aircraft === 'string' && source.aircraft.trim()
        ? source.aircraft.trim()
        : (typeof base.aircraft === 'string' && base.aircraft.trim() ? base.aircraft.trim() : 'Aircraft'),
      speeds: (sourceSpeeds.length ? sourceSpeeds : baseSpeeds).map((speed, index) => {
        const fallback = isPlainObject(baseSpeeds[index]) ? baseSpeeds[index] : {};
        return {
          ...fallback,
          ...(isPlainObject(speed) ? speed : {}),
        };
      }),
    };
  }

  function getVspeeds(defaults) {
    const parsed = safeParse(safeGet('aircraft-vspeeds'), null, 'aircraft-vspeeds');
    return normalizeVspeeds(parsed, defaults);
  }

  function saveVspeeds(data) {
    silentSet('aircraft-vspeeds', JSON.stringify(data));
  }

  function getSetting(key, fallback) {
    const value = safeGet(key);
    return value == null ? fallback : value;
  }

  function setSetting(key, value) {
    flashedSet(key, value);
  }

  function purgeStudentData(studentId) {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(studentId + '|')) doomed.push(key);
      }
      doomed.forEach(safeRemove);
    } catch {}
  }

  window.CFIData = {
    raw: { safeGet, silentSet, flashedSet, safeRemove, safeParse, studentScopedKey, flashAutosave, hideAutosave },
    meta: {
      getStorageSchemaVersion: () => parseInt(safeGet(STORAGE_SCHEMA_KEY) || String(STORAGE_SCHEMA_VERSION), 10) || STORAGE_SCHEMA_VERSION,
      ensureSchemaVersion,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      getHealthIssues: () => healthIssues.slice(),
    },
    students: { list: listStudents, saveAll: saveStudents, getActiveId: getActiveStudentId, setActiveId: setActiveStudentId, makeId, purgeData: purgeStudentData },
    lessonProgress: {
      getCompetency, setCompetency, getCompetencyDate, setCompetencyDate,
      getNote: getLessonNote, setNote: setLessonNote,
      getChecklistValue, setChecklistValue,
      getVisits, trackVisit,
      getMilestones, saveMilestones,
      getKnowledgeTest, saveKnowledgeTest,
      getMinimums, saveMinimums
    },
    flights: { list: listFlights, saveAll: saveFlights },
    endorsements: {
      getDone: getEndorsementDone, setDone: setEndorsementDone,
      getDate: getEndorsementDate, setDate: setEndorsementDate,
      getNotes: getEndorsementNotes, setNotes: setEndorsementNotes
    },
    settings: {
      getTheme, setTheme, exportAll, importAll, describeImport,
      getWbLast, setWbLast,
      getNavOrder, setNavOrder, clearNavOrder,
      getVspeeds, saveVspeeds,
      get: getSetting, set: setSetting,
      captureRecoverySnapshot, getRecoverySnapshot,
      shouldRemindBackup, dismissBackupReminder
    },
    analytics: {
      get: getAnalytics,
      logEvent: logAnalyticsEvent,
      markBackupCreated,
      markRestoreCompleted,
    },
  };

  ensureSchemaVersion();

  window.getStudents = listStudents;
  window.saveStudents = saveStudents;
  window.getActiveId = getActiveStudentId;
  window.setActiveId = setActiveStudentId;
  window.mkId = makeId;
  window.sk = (type, key) => studentScopedKey(activeStudentId(), type, key);
  window.sg = safeGet;
  window.ss = flashedSet;
  window.getComp = getCompetency;
  window.setComp = setCompetency;
  window.getCompDate = getCompetencyDate;
  window.setCompDate = setCompetencyDate;
  window.getFlights = listFlights;
  window.saveFlights = saveFlights;
  window.trackVisit = trackVisit;
  window.getVisits = getVisits;
  window.getMilestones = getMilestones;
  window.saveMilestones = saveMilestones;
  window.getKtest = getKnowledgeTest;
  window.saveKtest = saveKnowledgeTest;
  window.getMins = getMinimums;
  window.saveMins = saveMinimums;
  window.getVspeeds = function() { return getVspeeds(window.VSPEEDS_DEFAULTS || {}); };
  window.saveVspeeds = saveVspeeds;
})();
