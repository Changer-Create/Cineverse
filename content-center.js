(() => {
  'use strict';
  if (window.__CINEVERSE_CONTENT_BOOTSTRAP_V1__) return;
  window.__CINEVERSE_CONTENT_BOOTSTRAP_V1__ = true;
  const fresh = Date.now().toString(36);
  document.write(`<script src="content-center-runtime-v1.js?v=${fresh}"></script>`);
})();
