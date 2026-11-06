import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3107';
const initial=await (await fetch(base+'/api/store')).json();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
async function click(name){await page.getByRole('button',{name,exact:true}).click();}
async function save(kind){await click('Save '+kind);await page.getByRole('dialog').waitFor({state:'hidden',timeout:5000}).catch(async e=>{console.log(await page.getByRole('dialog').innerText());throw e;});}
async function nav(name){await page.locator('nav').getByRole('button',{name,exact:true}).click();}
try{
await page.goto(base);await page.getByRole('heading',{name:'Today',exact:true}).waitFor();await page.getByText('✓ Saved',{exact:true}).waitFor();
await click('＋ New task');await page.getByLabel('Title *',{exact:true}).fill('Browser task');await save('task');
await page.reload();await page.getByRole('button').filter({hasText:'Browser task'}).first().waitFor();
await nav('Workboard');await page.getByLabel('Status of Browser task').selectOption('In Progress');await page.getByText('✓ Saved',{exact:true}).waitFor();
await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/store')&&r.request().method()==='PUT'&&r.status()===200),page.locator('.card').filter({hasText:'Browser task'}).dragTo(page.locator('.column').nth(2))]);
assert.equal((await (await fetch(base+'/api/store')).json()).records.find(r=>r.title==='Browser task').status,'Testing');
await nav('Release Testing');await click('＋ New release');await page.getByLabel('Release name *',{exact:true}).fill('Browser release');await page.getByLabel('Product *',{exact:true}).selectOption('PAAQ app');await save('release');await page.getByRole('button').filter({hasText:'Browser release'}).click();
await click('＋ Add check');await page.getByLabel('Title *',{exact:true}).fill('Phone verification');await save('check');
await page.getByRole('button').filter({hasText:'Phone verification'}).click();await page.getByLabel('Result',{exact:true}).selectOption('Fail');await page.getByText('Test details & defect report',{exact:true}).click();await page.getByLabel('Actual result',{exact:true}).fill('Original failure');await save('check');
await page.getByRole('button').filter({hasText:'Phone verification'}).click();await page.getByLabel('Duplicate check to platform').selectOption('Android');await save('check');await click('Android');await page.getByRole('button').filter({hasText:'Phone verification'}).click();assert.equal(await page.getByLabel('Result',{exact:true}).inputValue(),'Not Recorded');await page.getByLabel('Result',{exact:true}).selectOption('Pass');await save('check');
await click('Web');await page.getByRole('button').filter({hasText:'Phone verification'}).click();assert.equal(await page.getByLabel('Result',{exact:true}).inputValue(),'Fail');await page.getByLabel('Result',{exact:true}).selectOption('Pass');await page.getByLabel('Workflow status').selectOption('Done');await save('check');
await page.getByRole('button').filter({hasText:'Phone verification'}).click();await page.getByText('Result history (2)',{exact:true}).click();await page.locator('.history').getByText('Original failure',{exact:true}).first().waitFor();await save('check');
await click('Save as template');await save('template');await page.getByLabel('Apply template').selectOption({label:'Browser release checklist'});await page.getByText('✓ Saved',{exact:true}).waitFor();
const state=await (await fetch(base+'/api/store')).json();const testChecks=state.records.filter(r=>r.kind==='check');assert.equal(testChecks.length,4);assert.equal(testChecks.filter(r=>r.result==='Not Recorded').length,2);
await nav('Workboard');await page.getByRole('button').filter({hasText:'Browser task'}).first().click();await click('Delete');await page.getByRole('dialog').waitFor({state:'hidden'});await nav('Settings');await click('Recently deleted (1)');await click('Restore');await page.getByText('✓ Saved',{exact:true}).waitFor();
await nav('Messages');await click('＋ Paste message');await page.getByLabel('Title *',{exact:true}).fill('Slack follow-up');await page.getByLabel('Message text').fill('Please review this release');await save('message');
await nav('Reports');await page.getByLabel('Report release').selectOption('');await click('Generate report');assert.match(await page.getByLabel('Editable report').inputValue(),/Browser task/);
await page.setViewportSize({width:390,height:844});await page.getByLabel('Toggle navigation').click();await nav('Today');assert.equal(await page.locator('h1').innerText(),'Today');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await page.screenshot({path:'/tmp/paaq-mobile.png',fullPage:true});
await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/paaq-desktop.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('Browser workflows passed: minimal records, persistence, status moves, platform copies, retest history, templates, delete/restore, messages, reports and mobile navigation.');
}finally{await browser.close();const latest=await (await fetch(base+'/api/store')).json();const reset=await fetch(base+'/api/store',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...initial,revision:latest.revision})});assert.ok(reset.ok,'Restore initial dashboard');}
