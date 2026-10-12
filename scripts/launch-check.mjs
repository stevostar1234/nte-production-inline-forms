// Lists everything that still makes this build a client-testing release rather than a
// public launch build. Exits with 1 while anything is outstanding; it changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const context = {window: {}};
vm.runInNewContext(read('source/assets/config.js'), context);
const config = context.window.NTE_CONFIG;
const hosting = JSON.parse(read('hosting.json'));
const build = JSON.parse(read('build-manifest.json'));

// Pages, images and the return page must live on the client's own website. Squarespace
// serves uploaded images from its CDN. Fonts, the logo upload request and Salesforce are
// the only other services the forms are meant to use.
const siteHosts = hosting.launchHosts || ['www.nationaltransitionevent.com', 'nationaltransitionevent.com',
  'images.squarespace-cdn.com', 'static1.squarespace.com'];
const serviceHosts = ['fonts.googleapis.com', 'fonts.gstatic.com', 'missioncommunityorg.sharepoint.com',
  new URL(config.endpoint).hostname];
const host = url => { try { return new URL(url).hostname; } catch { return ''; } };

const problems = [];
if (config.allowUnlinkedTermsForTesting === true) {
  problems.push('Terms: allowUnlinkedTermsForTesting is true, so the three application forms show an unlinked Terms and Conditions tick box.');
}
if (!/^https:\/\//.test(config.termsUrl || '')) {
  problems.push('Terms: termsUrl is empty. Link the approved Terms and Conditions before genuine applications.');
} else if (!siteHosts.includes(host(config.termsUrl))) {
  problems.push(`Terms: termsUrl ${config.termsUrl} is not on the NTE website.`);
}
if (config.privacyUrl && !siteHosts.includes(host(config.privacyUrl))) {
  problems.push(`Privacy: privacyUrl ${config.privacyUrl} is not on the NTE website.`);
}
if (build.mode !== 'production' || build.orgId !== '00Dd3000004vNGv') {
  problems.push(`Salesforce: build targets ${build.mode} org ${build.orgId}, not production 00Dd3000004vNGv.`);
}

// Every URL a visitor can be sent to or load, grouped so one missing mapping reads as one item.
const offsite = new Map();
for (const page of build.pages) {
  const block = read('code-blocks/' + page.slug + '.txt');
  for (const [, attr, url] of block.matchAll(/\b(src|href|data-nte-return-url)="(https?:\/\/[^"]+)"/g)) {
    if (siteHosts.includes(host(url)) || serviceHosts.includes(host(url))) continue;
    const key = (attr === 'data-nte-return-url' ? 'return page ' : attr === 'src' ? 'image ' : 'link ') + url;
    if (!offsite.has(key)) offsite.set(key, new Set());
    offsite.get(key).add(page.slug);
  }
}
for (const [what, slugs] of offsite) {
  const fix = what.startsWith('return page') ? 'set hosting.json returnUrls' : 'map it in hosting.json pageUrls';
  problems.push(`Off-site ${what} (${slugs.size === build.pages.length ? 'all blocks' : [...slugs].join(', ')}): ${fix}.`);
}

console.log(`NTE inline launch check, source ${build.sourceCommit.slice(0, 7)}, ${build.pages.length} blocks`);
if (!problems.length) {
  console.log('Ready: no client-testing settings or off-site dependencies remain.');
} else {
  for (const problem of problems) console.log('- ' + problem);
  console.log(`${problems.length} item(s) outstanding. Do not publish this build for genuine applications.`);
  process.exitCode = 1;
}
