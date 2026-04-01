// composables/useMarkdown.js

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function parseMarkdown(src) {
  if (!src) return ''
  let s = src

  // code blocks
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${escHtml(lang)}">${escHtml(code.trim())}</code></pre>`)
  // inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
  // headings
  s = s.replace(/^### (.+)$/gm, (_, t) => `<h3>${t}</h3>`)
  s = s.replace(/^## (.+)$/gm, (_, t) => `<h2>${t}</h2>`)
  s = s.replace(/^# (.+)$/gm, (_, t) => `<h1>${t}</h1>`)
  // blockquote
  s = s.replace(/^> (.+)$/gm, (_, t) => `<blockquote>${t}</blockquote>`)
  // bold+italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // links & images
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  // task lists
  s = s.replace(/^- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled/> $1</li>')
  s = s.replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled/> $1</li>')
  // lists
  s = s.replace(/^[*\-] (.+)$/gm, '<li>$1</li>')
  s = s.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
  s = s.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  // hr
  s = s.replace(/^---+$/gm, '<hr/>')
  // paragraphs
  s = s.replace(/\n\n+/g, '\n\n')
  const lines = s.split('\n')
  const out = []
  let inPre = false
  for (const l of lines) {
    if (l.startsWith('<pre')) { inPre = true }
    if (l.startsWith('</pre')) { inPre = false; out.push(l); continue }
    if (inPre) { out.push(l); continue }
    if (
      l.startsWith('<h') || l.startsWith('<ul') || l.startsWith('<ol') ||
      l.startsWith('<li') || l.startsWith('<blockquote') ||
      l.startsWith('<hr') || l === '' || l.startsWith('<img')
    ) {
      out.push(l)
    } else {
      out.push('<p>' + l + '</p>')
    }
  }
  return out.join('\n')
}

export function escapeHtml(s) {
  return escHtml(s)
}
