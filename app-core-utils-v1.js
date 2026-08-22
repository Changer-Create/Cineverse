(() => {
  'use strict';
  if (window.CineverseCoreUtils) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);

  const utils = {
    uid() {
      return crypto.randomUUID?.() || `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    },
    safeJSON(raw) {
      try { return JSON.parse(raw); } catch { return null; }
    },
    splitList(value) {
      return String(value || '').split(/[\/，,、;；]+/).map(item => item.trim()).filter(Boolean);
    },
    esc,
    escAttr:esc,
    localToday() {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    csvEscape(value) {
      const text = String(value ?? '');
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
  };

  window.CineverseCoreUtils = Object.freeze(utils);
})();
