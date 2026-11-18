// The games hub paints its static bilingual markup before showing it.
import { currentLang } from './lang.js';

/** Put static bilingual markup in the current language. */
export function paintText(root = document) {
  const en = currentLang() === 'en';
  root.querySelectorAll('[data-en]').forEach(el => {
    if (el.dataset.zh === undefined) el.dataset.zh = el.innerHTML;
    el.innerHTML = en ? el.dataset.en : el.dataset.zh;
  });
  root.querySelectorAll('[data-en-label]').forEach(el => {
    if (el.dataset.zhLabel === undefined) el.dataset.zhLabel = el.getAttribute('aria-label') || '';
    el.setAttribute('aria-label', en ? el.dataset.enLabel : el.dataset.zhLabel);
  });
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  document.documentElement.classList.add('i18n');
}
