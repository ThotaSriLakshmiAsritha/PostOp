const fs = require('fs');
const path = require('path');
const glob = require('glob');

function extractTextNodes(code) {
  const results = new Set();
  // crude regex to match JSX text between > and < on same line
  const regex = />\s*([^<>\n{][^<>\n]*?)\s*</g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    // ignore numeric-only
    if (/^\d+$/.test(text)) continue;
    // ignore single punctuation
    if (/^[^A-Za-z0-9]+$/.test(text)) continue;
    // ignore long interpolation-like
    if (/\{.*\}/.test(text)) continue;
    results.add(text);
  }
  return Array.from(results);
}

const files = glob.sync('src/**/*.tsx', { nodir: true });
const report = {};
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const texts = extractTextNodes(content);
  if (texts.length) report[f] = texts;
}
fs.writeFileSync('i18n_text_report.json', JSON.stringify(report, null, 2));
console.log('Report written to i18n_text_report.json with', Object.keys(report).length, 'files.');
