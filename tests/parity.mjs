import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=JSON.parse(read('source-manifest.json'));
const build=JSON.parse(read('build-manifest.json'));
const hosting=JSON.parse(read('hosting.json'));
for(const [file,hash] of Object.entries(source.files)) assert.equal(sha(fs.readFileSync(path.join(root,'source',file))),hash,file+' source integrity');
const engine=read('source/assets/forms.js'), config=read('source/assets/config.js');
assert.equal(build.engineSha256,sha(engine));
assert.equal(build.configSha256,sha(config));
assert.equal(build.mode,'production');
assert.equal(build.orgId,'00Dd3000004vNGv');
assert.equal(build.pages.filter(p=>p.form).length,10);
for(const page of build.pages){
  const fragment=read('code-blocks/'+page.slug+'.txt');
  const original=read('source/'+page.slug+'.html');
  assert.equal(sha(fragment),page.sha256,page.slug+' generated integrity');
  assert.ok(fragment.includes(engine),page.slug+' unchanged engine');
  assert.ok(fragment.includes(config),page.slug+' unchanged config');
  assert.ok(!/<(?:html|head|body)(?:\s|>)/i.test(fragment),page.slug+' HTML fragment');
  assert.ok(!/<script\b[^>]*\bsrc=/i.test(fragment),page.slug+' no external JS');
  assert.ok(!/<link\b/i.test(fragment),page.slug+' no external CSS');
  assert.ok(!/data-return-path=/.test(fragment),page.slug+' no relative return override');
  assert.ok(Buffer.byteLength(fragment)<400000 && fragment.length<300000,page.slug+' code block limit');
  const embeddedBody=fragment.match(/<div class="nte-inline-page[^"]*">([\s\S]*?)\n<\/div><\/div>\n<\/template>/)[1];
  let expectedBody=original.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
    .replace(/\s*<section class="email-preview-panel"[^>]*>[\s\S]*?<\/section>/g,'')
    .replace(/\s*<script[^>]*>[\s\S]*?<\/script>/g,'')
    .replace(/\s+data-return-path="[^"]*"/g,'')
    .replace(/\b(src|href)="([^"]+)"/g,(all,attr,url)=>/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)?all:`${attr}="${hosting.pageUrls[url]||new URL(url,source.baseUrl+page.slug+'.html').href}"`);
  assert.equal(embeddedBody,expectedBody,page.slug+' exact body content after documented packaging changes');
  assert.ok(!/email-preview-panel|email-templates\/examples/.test(embeddedBody),page.slug+' no reviewer UI');
  const script=fragment.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  const preview=read('previews/'+page.slug+'.html');
  assert.ok(preview.includes(fragment),page.slug+' preview is the exact delivered code block');
  console.log('PASS '+page.slug+' — content, engine, config, URLs, syntax, size and preview');
}
console.log('12 pages: source integrity and packaging parity passed.');
