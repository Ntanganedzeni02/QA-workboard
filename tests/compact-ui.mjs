import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3107';
const before=await (await fetch(base+'/api/store')).json();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto(base);await page.getByText('✓ Saved',{exact:true}).waitFor();
 assert.equal(await page.locator('h1').innerText(),'Today');
 const body=await page.locator('body').innerText();for(const text of ['YOUR PERSONAL WORKBOARD','A clear view of your day.','Personal space','Add your first record','View items','Recurring reminders','Messages needing a response'])assert.ok(!body.includes(text),text);
 assert.ok((await page.locator('.stats').boundingBox()).height<110);
 for(const empty of await page.locator('.empty').all())assert.ok((await empty.boundingBox()).height<90);
 assert.equal(await page.locator('.dashboard-grid > section').count(),4);
 await page.screenshot({path:'artifacts/today-desktop.png',fullPage:true});
 await page.locator('.stat').first().click();assert.equal(await page.locator('h1').innerText(),'Workboard');assert.equal(await page.getByLabel('Status or result').inputValue(),'Priority');
 for(const name of ['Release Testing','Defects & Retests','Messages','Needs Attention','Templates','Reports','Settings','Today']){await page.locator('nav').getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('h1').innerText(),name);}
 await page.getByRole('button',{name:'＋ New task',exact:true}).click();await page.getByLabel('Title *',{exact:true}).fill('Unsaved layout check');await page.getByLabel('Close editor').click();
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/today-mobile.png',fullPage:true});
 for(const name of ['Workboard','Release Testing','Defects & Retests','Messages','Needs Attention','Templates','Reports','Settings','Today']){await page.getByLabel('Toggle navigation').click();await page.locator('nav').getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('h1').innerText(),name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflows');}
 await page.reload();await page.getByText('✓ Saved',{exact:true}).waitFor();assert.deepEqual(await (await fetch(base+'/api/store')).json(),before);assert.deepEqual(errors,[]);
 console.log('PASS: exact URL, compact desktop/mobile layouts, all navigation, clickable count filter, task editor, no horizontal overflow, refresh, and unchanged real records.');
}finally{await browser.close();}
