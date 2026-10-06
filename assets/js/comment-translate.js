(() => {
  document.querySelectorAll('[data-comment-translator]').forEach((root) => {
    const input = root.querySelector('[data-translation-text]');
    const link = root.querySelector('[data-translation-link]');
    const update = () => {
      const text = input.value.trim();
      if (!text) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
        return;
      }
      const url = new URL('https://translate.google.com/');
      url.search = new URLSearchParams({ sl: 'auto', tl: root.dataset.target === 'zh-CN' ? 'zh-CN' : 'en', text, op: 'translate' }).toString();
      link.href = url.toString();
      link.setAttribute('aria-disabled', 'false');
      link.removeAttribute('tabindex');
    };
    input.addEventListener('input', update);
    link.addEventListener('click', (event) => {
      update();
      if (!input.value.trim()) event.preventDefault();
    });
    update();
  });
})();
