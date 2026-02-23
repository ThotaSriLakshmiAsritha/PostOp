const fs = require('fs');
const glob = require('glob');

function extractTextNodes(code) {
  const results = new Set();
  // stricter regex: text node that starts with a letter and contains at least one letter
  const regex = />\s*([A-Za-z][A-Za-z0-9\- _,.!?:'"()\/&]{1,200})\s*</g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    // ignore patterns that are obviously code fragments
    if (/^\{/.test(text) || /\}$/.test(text)) continue;
    // ignore short one-letter words like "a"
    if (text.length <= 1) continue;
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
fs.writeFileSync('i18n_text_report_strict.json', JSON.stringify(report, null, 2));
console.log('Report written to i18n_text_report_strict.json with', Object.keys(report).length, 'files.');
