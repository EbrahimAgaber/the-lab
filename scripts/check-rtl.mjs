// Fails (exit 1) if any UI source uses physical-direction CSS instead of logical properties.
// A line may opt out with the marker comment `rtl-ok` (must be justified in review).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = [
  { re: /\b(margin|padding|border|inset|scroll-margin|scroll-padding)-(left|right)\b/i, hint: 'use *-inline-start / *-inline-end' },
  { re: /\bborder-(top|bottom)-(left|right)-radius\b/i, hint: 'use border-start-start-radius etc.' },
  { re: /(^|[\s;{])(left|right)\s*:/i, hint: 'use inset-inline-start / inset-inline-end' },
  { re: /\btext-align\s*:\s*(left|right)\b/i, hint: 'use text-align: start / end' },
  { re: /\bfloat\s*:\s*(left|right)\b/i, hint: 'use float: inline-start / inline-end' },
  { re: /\b(margin|padding|border)(Left|Right)\b/, hint: 'use marginInlineStart etc. in JSX styles' },
  { re: /\btextAlign\s*:\s*['"](left|right)['"]/, hint: "use textAlign: 'start' | 'end'" },
];

export function checkSource(text) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.includes('rtl-ok')) return;
    for (const r of RULES) {
      if (r.re.test(line)) problems.push({ line: i + 1, text: line.trim(), hint: r.hint });
    }
  });
  return problems;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const files = walk(join(root, 'packages', 'ui', 'src'));
  let count = 0;
  for (const f of files) {
    for (const p of checkSource(readFileSync(f, 'utf8'))) {
      count++;
      console.error(`${relative(root, f)}:${p.line}: physical direction -> ${p.hint}\n    ${p.text}`);
    }
  }
  if (files.length === 0) {
    console.error('check-rtl: no UI files scanned (refusing vacuous pass)');
    process.exit(1);
  }
  console.log(`check-rtl: scanned ${files.length} files, ${count} violation(s)`);
  process.exit(count > 0 ? 1 : 0);
}
