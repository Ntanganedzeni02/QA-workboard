import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:3107';
let headers={};
if(process.env.TEST_PASSWORD){
assert.equal((await fetch(base+'/api/store')).status,401);
assert.equal((await fetch(base+'/api/evidence?id=00000000-0000-0000-0000-000000000000')).status,401);
assert.equal((await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'incorrect'})})).status,401);
const login=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.TEST_PASSWORD})});assert.equal(login.status,200);headers.Cookie=login.headers.get('set-cookie').split(';')[0];
}
const initial=await (await fetch(base+'/api/store',{headers})).json();
const slackStatus=await fetch(base+'/api/slack',{headers});assert.equal(slackStatus.status,200);const slackState=await slackStatus.json();assert.equal(typeof slackState.connected,'boolean');assert.ok('lastSync' in slackState);
const put=records=>fetch(base+'/api/store',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({revision:initial.revision,records})});
try{
const saved=await put([...initial.records,{id:crypto.randomUUID(),kind:'task',title:'API persistence check',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]);assert.equal(saved.status,200);assert.equal((await put([])).status,409);
const form=new FormData();form.append('file',new File(['Manual evidence check'],'proof.txt',{type:'text/plain'}));const upload=await fetch(base+'/api/evidence',{method:'POST',headers,body:form});assert.equal(upload.status,200);const f=await upload.json();const file=await fetch(base+'/api/evidence?id='+f.id,{headers});assert.equal(await file.text(),'Manual evidence check');assert.match(file.headers.get('content-disposition'),/attachment/);
const bad=await fetch(base+'/api/store',{method:'PUT',headers:{...headers,'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify(initial)});assert.equal(bad.status,401);
console.log('API checks passed: durable records, stale-write rejection, persistent file upload/download, origin protection'+(process.env.TEST_PASSWORD?', login and private evidence access.':'.'));
}finally{const latest=await (await fetch(base+'/api/store',{headers})).json();assert.equal((await fetch(base+'/api/store',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...initial,revision:latest.revision})})).status,200);}
