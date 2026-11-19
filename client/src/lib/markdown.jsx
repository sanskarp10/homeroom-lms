/**
 * A small, safe Markdown renderer for lesson articles. It builds React elements
 * directly (no innerHTML), so lesson text can never inject markup.
 * Supports: ## and ### headings, paragraphs, - and 1. lists, ``` code blocks,
 * `inline code`, **bold**, *italic* and [links](https://...).
 */
import { Fragment } from 'react';

function inline(text, keyBase) {
  const out = [];
  const rx = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={key}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{m[2].slice(2, -2)}</strong>);
    else if (m[3]) out.push(<em key={key}>{m[3].slice(1, -1)}</em>);
    else if (m[4]) out.push(<a key={key} href={m[5]} target="_blank" rel="noreferrer noopener">{m[4].slice(1, m[4].indexOf(']'))}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source = '', className = 'prose-lesson' }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const Tag = heading[1].length >= 3 ? 'h3' : 'h2';
      blocks.push(<Tag key={blocks.length}>{inline(heading[2], blocks.length)}</Tag>);
      i++;
      continue;
    }
    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const rx = bullet.test(line) ? bullet : numbered;
      const Tag = rx === bullet ? 'ul' : 'ol';
      const items = [];
      while (i < lines.length && rx.test(lines[i])) items.push(lines[i++].replace(rx, ''));
      blocks.push(<Tag key={blocks.length}>{items.map((item, n) => <li key={n}>{inline(item, `${blocks.length}-${n}`)}</li>)}</Tag>);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^#{1,3}\s/.test(lines[i]) && !bullet.test(lines[i]) && !numbered.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={blocks.length}>{para.map((p, n) => <Fragment key={n}>{n > 0 && ' '}{inline(p, `${blocks.length}-${n}`)}</Fragment>)}</p>);
  }
  return <div className={className}>{blocks}</div>;
}
