(function () {
  const existing = window.CFIEnv || {};
  const env = {
    dataMode: 'local',
    apiBaseUrl: '',
    reactEnabled: true,
    ...existing,
  };

  window.CFIEnv = env;
})();
