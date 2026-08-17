/**
 * LeapShop · 轻量 Markdown 渲染器（无第三方依赖）
 * ------------------------------------------------------------
 * 安全策略：先对原文做 HTML 转义，再做 Markdown 替换，
 * 链接仅放行 http/https 协议，杜绝 XSS 注入。
 * 支持：# / ## / ### 标题，**加粗**，*斜体*，`行内代码`，
 * [链接](https://…)，- / * 无序列表，1. 有序列表，段落与换行。
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* 行内语法：代码 → 加粗 → 斜体 → 链接（顺序保证互不干扰） */
function inline(s) {
  let t = s;
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // 链接：转义后的文本中引号为 &quot;，正则只需排除空格与 &quot;
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s&)]+(?:&amp;[^\s&)]+)*)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return t;
}

/** 将多行纯文本/Markdown 转为安全 HTML（外层包 .md 便于样式定位） */
export function renderMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];      // 累积中的段落行
  let listTag = null; // 当前打开的列表标签 'ul' | 'ol' | null

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join('<br>')}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listTag) { html.push(`</${listTag}>`); listTag = null; }
  };

  for (const raw of lines) {
    const line = escapeHtml(raw);
    const trimmed = line.trim();

    // 空行：收束当前段落 / 列表
    if (!trimmed) { flushPara(); closeList(); continue; }

    // 标题 # / ## / ###（映射为 h4-h6，适配详情区块的小字号层级）
    const h = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length + 3; // # → h4，## → h5，### → h6
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // 无序列表项 - / * / •
    const ul = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (listTag !== 'ul') { closeList(); html.push('<ul>'); listTag = 'ul'; }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // 有序列表项 1.
    const ol = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ol) {
      flushPara();
      if (listTag !== 'ol') { closeList(); html.push('<ol>'); listTag = 'ol'; }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // 普通文本行：并入当前段落
    closeList();
    para.push(trimmed);
  }
  flushPara();
  closeList();
  return `<div class="md">${html.join('')}</div>`;
}
