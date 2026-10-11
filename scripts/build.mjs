import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const write = (name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), {recursive:true}); fs.writeFileSync(path.join(root, name), value); };
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(read('source-manifest.json'));
const settings = JSON.parse(read('hosting.json'));
const config = read('source/assets/config.js');
const engine = read('source/assets/forms.js');
const context = {window:{}};
vm.runInNewContext(config, context);
const base = manifest.baseUrl;
const fontCss = read('source/assets/inter-font.css').replaceAll("'Inter'", "'NTE Inline Inter'");
const fontId = 'nte-inline-fonts-' + hash(fontCss).slice(0, 12);
const bootstrap = read('scripts/bootstrap.js');
const tagName = 'nte-inline-' + hash(bootstrap + config + engine + fontCss).slice(0,12);
const serialize = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const runtime = bootstrap
  .replace('__TAG_NAME__', serialize(tagName))
  .replaceAll('__FONT_ID__', serialize(fontId))
  .replace('__FONT_CSS__', serialize(fontCss))
  .replace('__CONFIG_JS__', () => config)
  .replace('__FORMS_JS__', () => engine);
if (/<\/script/i.test(runtime)) throw Error('Runtime contains an HTML script terminator');
new vm.Script(runtime);

// The standalone root is 16px. A Squarespace theme's root font must not change
// rem-based form typography; browser zoom still scales all dimensions normally.
function isolateCss(css) {
  return css.replace(/:root\b/g, '.nte-inline-root')
    .replace(/\bhtml\s*\{/g, '.nte-inline-root {')
    .replace(/\bbody\s*\{/g, '.nte-inline-page {')
    .replace(/(-?(?:\d*\.)?\d+)rem\b/g, (_, n) => `${Number((Number(n)*16).toFixed(5))}px`)
    .replace(/font-family: Inter,/g, 'font-family: "NTE Inline Inter",');
}
const reset = ':host { all: initial; display: block; }\n.nte-inline-root { all: initial; display: block; font-size: 16px; direction: ltr; text-align: left; }\n';
const mainCss = isolateCss(read('source/assets/styles.css'));
const volunteerCss = ''; 
const pageNames = Object.keys(manifest.files).filter(name=>name.endsWith('.html'));
const rows=[];
for (const filename of pageNames) {
  const source = read('source/'+filename);
  const slug = filename.slice(0,-5);
  const title = source.match(/<title>([\s\S]*?)<\/title>/i)[1];
  const match = source.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  let body=match[2];
  const returnPath = body.match(/data-return-path="([^"]+)"/)?.[1];
  let returnUrl = settings.returnUrls[slug] || (returnPath ? new URL(returnPath,base+filename).href : context.window.NTE_CONFIG.returnUrl);
  if (!/^https:\/\//.test(returnUrl)) throw Error('Expected an absolute HTTPS return URL: '+slug);
  const removedPanels = (body.match(/class="email-preview-panel"/g)||[]).length;
  body = body.replace(/\s*<section class="email-preview-panel"[^>]*>[\s\S]*?<\/section>/g, '');
  body = body.replace(/\s*<script\b[^>]*src="assets\/(?:config|forms)\.js[^\"]*"[^>]*>\s*<\/script>/g,'');
  if (/<script\b/i.test(body)) throw Error('Unexpected source script: '+filename);
  body = body.replace(/\s+data-return-path="[^"]*"/g,'');
  body = body.replace(/\b(src|href)="([^\"]+)"/g, (all,attr,url)=> {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) return all;
    const target=settings.pageUrls[url] || new URL(url,base+filename).href;
    return `${attr}="${target}"`;
  });
  const bodyClass = match[1].match(/class="([^"]*)"/)?.[1] || '';
  const usesInter = source.includes('fonts.googleapis.com/css2');
  const css = reset + (usesInter ? mainCss : mainCss.replace('"NTE Inline Inter", ', '')) + (source.includes('assets/volunteer-styles.css') ? '\n'+volunteerCss : '');
  const fragment = `<${tagName} data-nte-page="${slug}" data-nte-return-url="${returnUrl}"${usesInter?' data-nte-inter':''} lang="en-GB" style="display:block!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;text-align:left!important;">
<template data-nte-content>
<style>${css}</style>
<div class="nte-inline-root"><div class="nte-inline-page${bodyClass?' '+bodyClass:''}">${body}\n</div></div>
</template>
<p data-nte-ready role="status">This form could not load. Please refresh the page or contact <a href="mailto:nte@missioncommunity.org">nte@missioncommunity.org</a>.</p>
</${tagName}>
<script>\n${runtime}\n</script>\n`;
  const bytes=Buffer.byteLength(fragment);
  if(bytes>=400000 || fragment.length>=300000) throw Error('Code block too large: '+filename);
  write('code-blocks/'+slug+'.txt',fragment);
  write('previews/'+filename,`<!doctype html>\n<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>html,body{margin:0;padding:0}html{background:#f4f1eb}</style></head><body>\n${fragment}</body></html>\n`);
  rows.push({slug,title,form:source.includes('data-web-to-lead'),bytes,characters:fragment.length,sha256:hash(fragment),removedPreviewPanels:removedPanels,returnUrl});
}
write('build-manifest.json',JSON.stringify({sourceCommit:manifest.commit,tagName,fontId,mode:context.window.NTE_CONFIG.mode,endpoint:context.window.NTE_CONFIG.endpoint,orgId:context.window.NTE_CONFIG.orgId,engineSha256:hash(engine),configSha256:hash(config),pages:rows},null,2)+'\n');
const list = forms => rows.filter(row=>row.form===forms).map(row=>`<li><strong>${row.title}</strong><a href="code-blocks/${row.slug}.txt" download>Download code</a><a href="previews/${row.slug}.html" target="_blank" rel="noopener">Open form</a></li>`).join('\n');
write('index.html', `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>NTE forms for Squarespace</title><style>body{margin:0;background:#f4f1eb;color:#171417;font:16px/1.6 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:48px 24px}h1{line-height:1.12;font-size:40px}h2{margin-top:40px}ul{padding:0;list-style:none}li{display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding:20px 0;border-bottom:1px solid #ddd5c7}strong{flex:1 1 380px}a{color:#6f5929}p{max-width:720px}.status{display:inline-block;background:#f1eadb;padding:6px 12px;border-radius:6px}</style></head><body><main><span class="status">Salesforce production</span><h1>NTE forms for Squarespace</h1><p>Download a form’s text file and copy all of its contents into an HTML Code block. Keep Display Source switched off.</p><p><a href="nte-squarespace-code-blocks.zip" download>Download all code blocks</a> · <a href="INSTALL.txt">Installation guide</a></p><h2>Forms</h2><ul>${list(true)}</ul><h2>Supporting pages</h2><ul>${list(false)}</ul></main></body></html>\n`);
console.log(`Built ${rows.filter(row=>row.form).length} forms and ${rows.filter(row=>!row.form).length} supporting pages. Largest block: ${Math.max(...rows.map(row=>row.bytes))} bytes.`);
