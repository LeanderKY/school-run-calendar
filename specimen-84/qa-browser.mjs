import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.S84_URL || 'http://127.0.0.1:4173/specimen-84/';
await fs.mkdir('specimen-84/qa-output',{recursive:true});

const report={desktop:{},mobile:{},consoleErrors:[],pageErrors:[],networkErrors:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function cleanNetwork(url,status){
  if(status<400)return true;
  // Known local-first model probe; the renderer then loads the same CC0 model remotely.
  if(url.endsWith('/assets/ScatteringSkull.glb')&&status===404)return true;
  return false;
}

async function attachDiagnostics(page,label){
  page.on('console',m=>{
    if(m.type()!=='error')return;
    const text=m.text();
    // Resource failures are checked with the response listener below, which still catches unexpected 4xx/5xx URLs.
    if(text.startsWith('Failed to load resource:'))return;
    report.consoleErrors.push(`${label}: ${text}`);
  });
  page.on('pageerror',e=>report.pageErrors.push(`${label}: ${e.message}`));
  page.on('response',r=>{if(!cleanNetwork(r.url(),r.status()))report.networkErrors.push(`${label}: ${r.status()} ${r.url()}`);});
}

async function ready(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#loader')?.classList.contains('is-done'),null,{timeout:25000}).catch(()=>{});
  await sleep(500);
}

async function shot(page,name){
  await page.screenshot({path:`specimen-84/qa-output/${name}.png`,fullPage:false});
}

async function scrollTo(page,selector){
  await page.locator(selector).scrollIntoViewIfNeeded();
  await sleep(450);
}

const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-gl=swiftshader']});

try{
  const desktop=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await desktop.newPage();
  await attachDiagnostics(page,'desktop');
  await ready(page);
  await shot(page,'desktop-00-arrival');

  // 01 / ACQUIRE — break seal and rotate.
  await scrollTo(page,'#acquire');
  let box=await page.locator('#acquireField').boundingBox();
  if(box){
    await page.mouse.move(box.x+box.width*.58,box.y+box.height*.48);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.76,box.y+box.height*.38,{steps:14});
    await page.mouse.up();
  }
  report.desktop.acquire=await page.evaluate(()=>Boolean(window.S84?.state.contactAt)&&document.querySelector('#custodySeal')?.classList.contains('is-broken'));
  await shot(page,'desktop-01-acquire');

  // 02 / SCAN — deliberately traverse all three anomaly planes.
  await scrollTo(page,'#scan');
  box=await page.locator('#scanner').boundingBox();
  if(box){
    const x=box.x+box.width*.5;
    await page.mouse.move(x,box.y+box.height*.5);await page.mouse.down();
    for(const y of [.23,.54,.79])await page.mouse.move(x,box.y+box.height*y,{steps:18});
    await page.mouse.up();
  }
  report.desktop.scan=await page.evaluate(()=>window.S84?.state.anomalies?.filter(Boolean).length===3);
  await shot(page,'desktop-02-scan');

  // 03 / SIGNAL — exact frequency must be held, not merely crossed.
  await scrollTo(page,'#signal');
  await page.$eval('#freqInput',el=>{el.value='13.8';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await sleep(850);
  report.desktop.tuner=await page.evaluate(()=>Boolean(window.S84?.state.tunerLocked));
  await shot(page,'desktop-03-signal');

  // 04 / FRAGMENT — hold long enough to reach a readable state.
  await scrollTo(page,'#fragment');
  box=await page.locator('#stabilizer').boundingBox();
  if(box){await page.mouse.move(box.x+box.width*.45,box.y+box.height*.55);await page.mouse.down();await sleep(1350);await page.mouse.up();}
  report.desktop.fragment=await page.evaluate(()=>window.S84?.state.fragmentBest>.9);
  await shot(page,'desktop-04-fragment');

  // 05 / RECONSTRUCT — use the keyboard path to prove non-pointer accessibility too.
  await scrollTo(page,'#reconstruct');
  await page.locator('[data-frame="A"]').focus();await page.keyboard.press('ArrowLeft');
  await page.locator('[data-frame="B"]').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
  await sleep(250);
  report.desktop.reconstruct=await page.evaluate(()=>Boolean(window.S84?.state.reconstruction));
  await shot(page,'desktop-05-reconstruct');

  // 06 / DARK ROOM — drag inspection light to the impossible mark.
  await scrollTo(page,'#release');
  box=await page.locator('#darkroom').boundingBox();
  if(box){
    await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.80,box.y+box.height*.58,{steps:20});await page.mouse.up();
  }
  report.desktop.release=await page.evaluate(()=>Boolean(window.S84?.state.lightFound));
  report.desktop.trace=await page.locator('#operatorTrace').innerText();
  report.desktop.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  await shot(page,'desktop-06-release');
  await desktop.close();

  // Mobile is inspected separately because the design must not just be a shrunken desktop.
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const m=await mobile.newPage();
  await attachDiagnostics(m,'mobile');await ready(m);
  const acts=['acquire','scan','signal','fragment','reconstruct','release'];
  for(let i=0;i<acts.length;i++){
    await scrollTo(m,`#${acts[i]}`);
    await shot(m,`mobile-${String(i+1).padStart(2,'0')}-${acts[i]}`);
  }
  report.mobile.horizontalOverflow=await m.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  report.mobile.hitTargets=await m.evaluate(()=>{
    const sels=['#acquireField','#scanner','#freqInput','#stabilizer','.evidence-strip','#darkroom'];
    return sels.map(s=>{const el=document.querySelector(s),r=el?.getBoundingClientRect();return {selector:s,w:r?.width||0,h:r?.height||0};});
  });
  await mobile.close();
} finally {
  await browser.close();
}

const required=['acquire','scan','tuner','fragment','reconstruct','release'];
report.ok=required.every(k=>report.desktop[k]===true)&&report.desktop.horizontalOverflow<=2&&report.mobile.horizontalOverflow<=2&&report.consoleErrors.length===0&&report.pageErrors.length===0&&report.networkErrors.length===0;
await fs.writeFile('specimen-84/qa-output/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
