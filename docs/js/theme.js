/* Φορτώνεται στο <head> πριν από το CSS render: ορίζει θέμα χωρίς «αναβόσβημα». */
(function () {
  'use strict';
  var root = document.documentElement;
  var stored = null;
  try { stored = window.localStorage.getItem('eform.theme'); } catch (e) { /* ιδιωτική περιήγηση */ }
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', stored === 'light' || stored === 'dark' ? stored : (prefersLight ? 'light' : 'dark'));
  root.classList.add('js');

  // Το dashboard δεν επιτρέπεται να φορτωθεί μέσα σε iframe άλλης σελίδας (clickjacking).
  if (root.getAttribute('data-page') === 'dashboard' && window.top !== window.self) {
    root.style.display = 'none';
    try { window.top.location.replace(window.self.location.href); } catch (e) { /* cross-origin */ }
  }
})();
