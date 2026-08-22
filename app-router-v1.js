(() => {
  'use strict';
  if (window.CineverseRouter) return;

  const normalizeHash = hash => String(hash || '').replace(/^#/, '');

  function createRouter({ pages, navigationSelector = '.nav a[data-view]', detail, fallback = 'home', passthrough = [] }) {
    const pageNames = Object.keys(pages);
    let current = '';

    const setNavigation = name => {
      const activeName = name === 'detail' ? 'library' : name;
      document.querySelectorAll(navigationSelector).forEach(link => {
        const active = link.dataset.view === activeName;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    function navigate(name, { updateHash = true, hash = name } = {}) {
      if (!pages[name]) return false;
      for (const pageName of pageNames) {
        pages[pageName].element.classList.toggle('hidden', pageName !== name);
      }
      setNavigation(name);
      pages[name].enter?.();
      current = name;
      if (updateHash && normalizeHash(location.hash) !== hash) location.hash = hash;
      return true;
    }

    function routeHash(rawHash = location.hash) {
      const route = normalizeHash(rawHash);
      if (route.startsWith('detail/')) {
        let id = '';
        try { id = decodeURIComponent(route.slice(7)); } catch { id = ''; }
        if (id && detail?.enter(id)) return navigate('detail', { updateHash:false });
        return navigate(detail?.fallback || 'library', { hash:detail?.fallback || 'library' });
      }
      if (route && passthrough.some(owner => typeof owner === 'function' ? owner(route) : route.startsWith(String(owner)))) return false;
      return navigate(pages[route] ? route : fallback, {
        updateHash: route !== fallback || Boolean(rawHash),
        hash: pages[route] ? route : fallback
      });
    }

    const onHashChange = () => routeHash(location.hash);
    return Object.freeze({
      navigate,
      routeHash,
      start() { window.addEventListener('hashchange', onHashChange); return routeHash(location.hash); },
      destroy() { window.removeEventListener('hashchange', onHashChange); },
      getCurrent: () => current
    });
  }

  window.CineverseRouter = Object.freeze({ createRouter, normalizeHash });
})();
