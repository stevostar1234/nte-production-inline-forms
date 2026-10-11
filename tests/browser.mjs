import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const manifest=JSON.parse(read('build-manifest.json'));
const base=process.env.NTE_TEST_URL||'http://127.0.0.1:8766';
const out=path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.NTE_BROWSER_EXECUTABLE?{executablePath:process.env.NTE_BROWSER_EXECUTABLE}:{})});
const results=[];
const payloads=[];
const selected=process.env.NTE_TEST_SLUG;
let branchChecks=0, capturedPosts=0;

function state(){
 const r=document.querySelector('[data-nte-page]')?.shadowRoot||document;
 const form=r.querySelector('form[data-web-to-lead]');
 return {
  fields:[...r.querySelectorAll('input,select,textarea,button')].map(e=>({id:e.id,name:e.name,type:e.type,value:e.value,checked:e.checked,required:e.required,disabled:e.disabled,readOnly:e.readOnly,min:e.min,max:e.max,maxLength:e.maxLength,step:e.step,invalid:e.getAttribute('aria-invalid'),validation:e.validationMessage,visible:!!e.getClientRects().length})),
  sections:[...r.querySelectorAll('[data-conditional-for]')].map(e=>({for:e.dataset.conditionalFor,hidden:e.hidden})),
  totals:[...r.querySelectorAll('[data-estimate],[data-package-total],[data-package-count],[data-top-up-estimate],[data-form-status]')].map(e=>({text:e.textContent,hidden:e.hidden})),
  busy:form?.getAttribute('aria-busy')||null
 };
}
function apply({index,value,checked}){
 const r=document.querySelector('[data-nte-page]')?.shadowRoot||document;
 const e=r.querySelectorAll('input,select,textarea,button')[index];
 if(checked!==undefined)e.checked=checked;else e.value=value;
 e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
}
function complete(){
 const r=document.querySelector('[data-nte-page]')?.shadowRoot||document;
 const f=r.querySelector('form[data-web-to-lead]');
 const update=e=>{e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};
 for(let pass=0;pass<5;pass++){
  for(const e of f.querySelectorAll('input,select,textarea')){
   if(!e.required||e.disabled||e.type==='hidden'||(e.value&&!['checkbox','radio'].includes(e.type)))continue;
   if(e.type==='checkbox')e.checked=true;
   else if(e.type==='radio'){
    if([...f.querySelectorAll('input[type=radio]')].some(x=>x.name===e.name&&x.checked))continue;
    e.checked=true;
   }else if(e.tagName==='SELECT')e.value=[...e.options].some(o=>o.value==='No')?'No':[...e.options].find(o=>o.value)?.value||'';
   else e.value=e.type==='email'?'inline.qa@example.invalid':e.type==='number'?e.min||'1':e.type==='date'?'1990-04-11':e.type==='tel'?'+44 7700 900456':e.dataset.sfField==='Target_Booking_Reference__c'?'NTE-1791504000000-ABCDEFGH':'Alex Morgan';
   update(e);
  }
  for(const group of f.querySelectorAll('[data-required-checkbox-group]')){
   if(!group.querySelector('input:checked')){const e=group.querySelector('input:not(:disabled)');e.checked=true;update(e);}
  }
 }
 const conduct=f.querySelector('[data-conduct-document]');
 if(conduct){conduct.open=true;conduct.dispatchEvent(new Event('toggle'));const reader=f.querySelector('[data-conduct-reader]');reader.scrollTop=reader.scrollHeight;reader.dispatchEvent(new Event('scroll'));const e=f.querySelector('[data-conduct-acknowledgement]');e.checked=true;update(e);}
}
function submit(){(document.querySelector('[data-nte-page]')?.shadowRoot||document).querySelector('form[data-web-to-lead]').requestSubmit();}
const compare=async(a,b,label)=>assert.deepEqual(await b.evaluate(state),await a.evaluate(state),label);

try{
 for(const entry of manifest.pages.filter(p=>!selected||p.slug===selected)){
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,locale:'en-GB',timezoneId:'Europe/London',reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   const NativeDate=Date;
   window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-09T10:30:00Z']));}static now(){return new NativeDate('2026-10-09T10:30:00Z').getTime();}};
   Object.defineProperty(window.crypto,'getRandomValues',{value:a=>{a.forEach((_,i)=>a[i]=(i*11+7)%256);return a;}});
   window.__posts=[];
   HTMLFormElement.prototype.submit=function(){window.__posts.push({action:this.action,method:this.method,fields:Object.fromEntries(new FormData(this))});this.remove();};
  });
  await context.route('**/*',async route=>{
   if(route.request().method()!=='GET')return route.abort();
   const url=new URL(route.request().url());
   if(url.hostname.includes('salesforce.com'))return route.abort();
   if(url.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:read('source/assets/inter-font.css')});
   if(url.hostname==='stevostar1234.github.io'&&url.pathname.includes('/assets/')){
    const asset=path.join(root,'source/assets',path.basename(url.pathname));
    if(fs.existsSync(asset))return route.fulfill({path:asset});
   }
   return route.continue();
  });
  const a=await context.newPage(), b=await context.newPage(),errors=[];
  a.on('pageerror',e=>errors.push('source: '+e.message));b.on('pageerror',e=>errors.push('inline: '+e.message));
  async function open(){
   await Promise.all([a.goto(base+'/source/'+entry.slug+'.html'),b.goto(base+'/previews/'+entry.slug+'.html')]);
   await a.evaluate(()=>document.querySelectorAll('.email-preview-panel').forEach(e=>e.remove()));
   await b.waitForSelector('[data-nte-initialized=true]');
   await Promise.all([a.evaluate(()=>document.fonts.ready),b.evaluate(()=>document.fonts.ready)]);
   await Promise.all([a.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))),b.evaluate(()=>Promise.all([...document.querySelector('[data-nte-page]').shadowRoot.querySelectorAll('img')].map(i=>i.decode().catch(()=>{}))))]);
   // Enforce font readiness explicitly: a fallback must never count as parity.
   if(entry.slug!=='thank-you'){
    assert.ok(await a.evaluate(()=>document.fonts.check('400 16px Inter')),'baseline font');
    assert.ok(await b.evaluate(()=>document.fonts.check('400 16px "NTE Inline Inter"')),'inline font');
   }
  }
  await open();
  await compare(a,b,entry.slug+' initial constraints');
  const visuals=[];
  for(const width of [1280,375]){
   await Promise.all([a.setViewportSize({width,height:900}),b.setViewportSize({width,height:900})]);
   await a.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await b.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const shots=[];
   for(const page of [a,b]){
    await page.bringToFront();
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    shots.push(await page.screenshot({fullPage:true,animations:'disabled',caret:'hide'}));
   }
   const [p,q]=shots.map(s=>PNG.sync.read(s));
   assert.equal(q.width,p.width,entry.slug+' width');assert.equal(q.height,p.height,entry.slug+' height');
   let pixels=0;for(let n=0;n<p.data.length;n+=4){if(p.data[n]!==q.data[n]||p.data[n+1]!==q.data[n+1]||p.data[n+2]!==q.data[n+2]||p.data[n+3]!==q.data[n+3])pixels++;}
   fs.writeFileSync(path.join(out,entry.slug+'-'+width+'-source.png'),shots[0]);fs.writeFileSync(path.join(out,entry.slug+'-'+width+'-inline.png'),shots[1]);
   visuals.push({width,height:p.height,differingPixels:pixels});
   assert.equal(pixels,0,entry.slug+' raw pixel identity at '+width);
  }
  await Promise.all([a.setViewportSize({width:1280,height:900}),b.setViewportSize({width:1280,height:900})]);
  await b.addStyleTag({content:'html{font-size:23px}body{font-family:serif;color:red;letter-spacing:3px;text-transform:uppercase;line-height:2;text-align:right}h1,h2,p,input,button,select,textarea{font:28px monospace!important;color:magenta!important;border-radius:0!important}.card,.grid,.button{display:inline!important}img{max-width:40px!important}'});
  // Check geometry and computed presentation of every rendered element, not only screenshots.
  const presentation=()=>{
   const host=document.querySelector('[data-nte-page]');const r=host?.shadowRoot.querySelector('.nte-inline-page')||document.body;
   return [...r.querySelectorAll('*')].filter(e=>!['SCRIPT','STYLE'].includes(e.tagName)&&!e.hasAttribute('data-form-honeypot')).map(e=>{const s=getComputedStyle(e),rect=e.getBoundingClientRect();return [e.tagName,e.id,...['color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform','padding','margin','display','borderRadius'].map(k=>k==='fontFamily'?s[k].replaceAll('"NTE Inline Inter"','Inter').replace(/^Inter, /,''):s[k]),rect.x,rect.y,rect.width,rect.height];});
  };
  assert.deepEqual(await b.evaluate(presentation),await a.evaluate(presentation),entry.slug+' hostile theme presentation');
  if(entry.form){
   await Promise.all([a.evaluate(submit),b.evaluate(submit)]);await compare(a,b,entry.slug+' empty validation');
   assert.equal((await b.evaluate(()=>window.__posts)).length,0,'invalid input never posts');
   await open();
   const operations=await a.evaluate(()=>[...document.querySelectorAll('input,select,textarea,button')].flatMap((e,index)=>e.tagName==='SELECT'?[...e.options].filter(o=>o.value).map(o=>({index,value:o.value})):['checkbox','radio'].includes(e.type)?[{index,checked:true},{index,checked:false}]:[]));
   for(const operation of operations){await Promise.all([a.evaluate(apply,operation),b.evaluate(apply,operation)]);await compare(a,b,entry.slug+' control '+operation.index);branchChecks++;}
   await open();
   await Promise.all([a.evaluate(complete),b.evaluate(complete)]);
   await compare(a,b,entry.slug+' completed values');
   await Promise.all([a.evaluate(submit),b.evaluate(submit)]);
   const posts=await a.evaluate(()=>window.__posts), inlinePosts=await b.evaluate(()=>window.__posts);
   assert.equal(posts.length,1,entry.slug+' valid source capture '+JSON.stringify(await a.evaluate(state)));
   assert.equal(inlinePosts.length,1,entry.slug+' valid inline capture');
   // The local source volunteer URL is resolved to the same public destination
   // it uses when hosted. All remaining POST fields must be identical.
   if(entry.slug==='volunteer-application')posts[0].fields.retURL=entry.returnUrl;
   assert.deepEqual(inlinePosts,posts,entry.slug+' exact native POST');
   assert.equal(posts[0].action,manifest.endpoint,entry.slug+' production endpoint');
   assert.equal(posts[0].fields.oid,manifest.orgId,entry.slug+' production org');
   assert.equal(posts[0].fields.retURL,entry.returnUrl,entry.slug+' return destination');
   payloads.push({slug:entry.slug,post:posts[0]});capturedPosts+=2;
   await Promise.all([a.evaluate(submit),b.evaluate(submit)]);
   assert.equal((await b.evaluate(()=>window.__posts)).length,1,entry.slug+' duplicate submit');
  }
  assert.deepEqual(errors,[],entry.slug+' runtime');
  results.push({slug:entry.slug,visuals,hostTheme:'matched',functional:entry.form?'matched':'supporting page'});
  console.log('PASS '+entry.slug+' '+JSON.stringify(visuals));
  await context.close();
 }
 fs.writeFileSync(path.join(out,'captured-payloads.json'),JSON.stringify(payloads,null,2)+'\n');
 fs.writeFileSync(path.join(out,'root-review.json'),JSON.stringify({sourceCommit:manifest.sourceCommit,branchChecks,capturedPosts,realSubmissions:0,results},null,2)+'\n');
}finally{await browser.close();}
