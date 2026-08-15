/**
 * Prototype F · Our Journey 页脚本
 * 居中品牌故事（全文直接引用自 The Craft of Web UI Design.md）。
 */
import { JOURNEY_DOC, escapeHtml } from './mock.js';

document.querySelector('#journeyDoc').innerHTML = JOURNEY_DOC.map((b) => `
  <section class="reveal">
    <h2 class="jd-h">${escapeHtml(b.h)}</h2>
    ${b.ps.map((t) => `<p class="jd-p">${escapeHtml(t)}</p>`).join('')}
    ${b.bullets.length ? `<ul class="jd-ul">${b.bullets.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
  </section>`).join('');

window.PF.observeReveals();
