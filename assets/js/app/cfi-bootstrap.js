(function() {
  if (!window.CFIApp) {
    throw new Error('CFIApp shell failed to load before bootstrap.');
  }

  const requiredModules = ['lessons', 'search', 'flights', 'dashboard', 'endorsements', 'tools', 'students'];
  requiredModules.forEach(name => {
    if (!CFIApp.getModule(name)) {
      throw new Error(`Required module "${name}" is missing.`);
    }
  });

  CFIApp.initShell();
  requiredModules.forEach(name => CFIApp.getModule(name)?.init?.());
  CFIApp.getModule('tools')?.rebuildStudentSelect?.();
  CFIApp.refreshStudentContext({ reason: 'bootstrap' });
  CFIApp.switchView('home');
})();
