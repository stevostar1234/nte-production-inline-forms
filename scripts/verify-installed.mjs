// Confirms that each published page carries the exact code block from this release.
// Usage: node scripts/verify-installed.mjs <page URL> [<page URL> ...]
// It only reads the public pages. Run it after pasting or replacing a block and saving.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Usage: node scripts/verify-installed.mjs <page URL> [<page URL> ...]');
  process.exit(2);
}

let failures = 0;
for (const url of urls) {
  let html;
  try {
    const response = await fetch(url, {headers: {'cache-control': 'no-cache'}});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    html = await response.text();
  } catch (error) {
    console.log(`FAIL ${url}: could not read the page (${error.message})`);
    failures++;
    continue;
  }
  const blocks = [...html.matchAll(/<(nte-inline-[a-f0-9]{12})\b[^>]*\bdata-nte-page="([^"]+)"/g)];
  if (!blocks.length) {
    console.log(`FAIL ${url}: no NTE form block found (is Display Source off and the page published?)`);
    failures++;
    continue;
  }
  for (const match of blocks) {
    const [, tag, slug] = match;
    const close = html.indexOf('</' + tag + '>', match.index);
    const end = close < 0 ? -1 : html.indexOf('</script>', close);
    const live = end < 0 ? html.slice(match.index) : html.slice(match.index, end + '</script>'.length);
    const file = path.join(root, 'code-blocks', slug + '.txt');
    if (!fs.existsSync(file)) {
      console.log(`FAIL ${url}: block for "${slug}" is not part of this release`);
      failures++;
      continue;
    }
    const expected = fs.readFileSync(file, 'utf8').trim();
    if (live.trim() === expected) {
      console.log(`OK   ${url}: ${slug} matches this release (${expected.length} characters)`);
      continue;
    }
    failures++;
    if (tag !== build.tagName) {
      console.log(`FAIL ${url}: ${slug} is a different release (${tag}, this release is ${build.tagName}). Replace the whole block.`);
    } else if (end < 0 || expected.startsWith(live.trim())) {
      console.log(`FAIL ${url}: ${slug} is incomplete (${live.length} of ${expected.length} characters). The block was cut short.`);
    } else {
      let at = 0;
      while (at < expected.length && live[at] === expected[at]) at++;
      console.log(`FAIL ${url}: ${slug} differs from this release at character ${at}. Replace the whole block.`);
    }
  }
}
process.exitCode = failures ? 1 : 0;
