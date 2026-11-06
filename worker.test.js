import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import worker,{CATEGORIES} from './worker.js';
const hash=createHash('sha256').update('test:password').digest('hex');
const env={AUTH_HASH:hash,SHEETS_ENDPOINT:'https://script.google.com/macros/s/test/exec'};
const req=(path,options={})=>new Request('https://shunga.example'+path,{...options,headers:{Authorization:'Basic '+btoa('test:password'),...options.headers}});
const save=(body,origin='https://shunga.example')=>req('/api/inventory',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('content and inventory require credentials',async()=>{for(const p of ['/','/app.js','/api/inventory','/faltantes.pdf','/etiquetas.xls'])assert.equal((await worker.fetch(new Request('https://shunga.example'+p),env)).status,401);});
test('reads Sheets through a signed server request',async t=>{t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,env.SHEETS_ENDPOINT);const envelope=JSON.parse(options.body);assert.equal(envelope.sig,createHmac('sha256',hash).update(envelope.body).digest('base64'));assert.equal(JSON.parse(envelope.body).action,'read');return Response.json({ok:true,products:[{id:'test',physical:null,revision:0}]});});const r=await worker.fetch(req('/api/inventory'),env),d=await r.json();assert.equal(d.storage,'google-sheets');assert.equal(d.products[0].physical,null);assert.equal(CATEGORIES.length,8);});
test('save confirms only Sheets response and preserves conflicts',async t=>{let payload;t.mock.method(globalThis,'fetch',async(url,options)=>{payload=JSON.parse(JSON.parse(options.body).body);return Response.json(payload.revision===0?{ok:true,value:0,revision:1}:{ok:false,conflict:true,error:'Actualiza'});});const r=await worker.fetch(save({id:'test',value:0,previous:null,revision:0}),env);assert.equal(r.status,200);assert.equal((await r.json()).value,0);assert.equal(payload.action,'write');assert.equal((await worker.fetch(save({id:'test',value:1,previous:0,revision:2}),env)).status,409);});
test('invalid and cross-origin changes never reach Sheets',async t=>{t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected write');});assert.equal((await worker.fetch(save({id:'test',value:21,previous:null,revision:0}),env)).status,400);assert.equal((await worker.fetch(save({},'https://evil.example'),env)).status,403);assert.equal((await worker.fetch(save({}),{AUTH_HASH:hash})).status,503);});
test('page uses manual Save per card and prints a fresh PDF',async()=>{const r=await worker.fetch(req('/shunga/'),env);assert.equal(r.headers.get('X-Frame-Options'),'DENY');assert.ok((await r.text()).includes('href="/shunga/faltantes.pdf"')); const app=await (await worker.fetch(req('/app.js'),env)).text();assert.ok(app.includes('Guardar'));assert.ok(!app.includes('window.print'));});
test('reset requires explicit confirmation before reaching Sheets',async t=>{let called=0;t.mock.method(globalThis,'fetch',async()=>{called++;return Response.json({ok:true,count:1});});const make=body=>req('/api/reset',{method:'POST',headers:{Origin:'https://shunga.example','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal((await worker.fetch(make({confirmed:false,expected:[{id:'test',previous:2,revision:0}]}),env)).status,400);assert.equal(called,0);const r=await worker.fetch(make({confirmed:true,expected:[{id:'test',previous:2,revision:0}]}),env);assert.equal(r.status,200);assert.equal(called,1);});
test('photos require authentication and are served from private catalog storage',async()=>{const catalog={prepare:()=>({bind:()=>({first:async()=>({image_base64:'AA==',mime:'image/webp'})})})};assert.equal((await worker.fetch(new Request('https://shunga.example/photos/SH1'),{...env,CATALOG:catalog})).status,401);const r=await worker.fetch(req('/photos/SH1'),{...env,CATALOG:catalog});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/webp');assert.equal(r.headers.get('Cache-Control'),'private, max-age=86400');});
test('PDF notes and photos enrich the live Sheet data without changing counts',async t=>{t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,products:[{id:'test',model:'SH1',physical:7,revision:4}]}));const CATALOG={prepare:()=>({all:async()=>({results:[{model:'SH1',info_json:JSON.stringify({note:'Foto de referencia',page:2}),has_photo:1}]})})};const d=await (await worker.fetch(req('/api/inventory'),{...env,CATALOG})).json();assert.equal(d.products[0].physical,7);assert.equal(d.products[0].photo,'/photos/SH1');assert.equal(d.products[0].catalogNote,'Foto de referencia');});
test('PDF reads column H from Sheets, not locally computed stock',async t=>{let reads=0;t.mock.method(globalThis,'fetch',async()=>{reads++;return Response.json({ok:true,products:[{name:'Producto de prueba',variant:'ROSA',ideal:999,physical:0,shortfall:2}]});});const r=await worker.fetch(req('/faltantes.pdf'),env);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'application/pdf');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok((await r.text()).startsWith('%PDF-'));assert.equal(reads,1);});
test('missing or invalid H cannot produce an inaccurate PDF',async t=>{t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,products:[{name:'A',variant:'B',shortfall:'#VALUE!'}]}));assert.equal((await worker.fetch(req('/faltantes.pdf'),env)).status,422);});

test('labels download is authenticated, fresh and has genuine XLS content',async t=>{
 let reads=0;t.mock.method(globalThis,'fetch',async()=>{reads++;return Response.json({ok:true,products:[{model:'SH1',variant:'ROSA',id:'00123',shortfall:2,cost:10,price:20,brand:85}]});});
 const r=await worker.fetch(req('/etiquetas.xls'),env);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'application/vnd.ms-excel');assert.match(r.headers.get('Content-Disposition'),/attachment; filename="SHUNGA-Etiquetas.xls"/);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(new Uint8Array(await r.arrayBuffer())[0],208);assert.equal(reads,1);
});
test('labels button preserves unsaved edits and reports download errors',async()=>{const html=await (await worker.fetch(req('/shunga/'),env)).text();assert.match(html,/id="labels"[^>]*>Etiquetas/);const app=await (await worker.fetch(req('/app.js'),env)).text();assert.match(app,/Guarda cada producto antes de descargar las etiquetas/);});

test('home selects inventories and each catalog has its own links and script routes',async()=>{
 const home=await (await worker.fetch(req('/'),env)).text();assert.match(home,/href="\/shunga\/"/);assert.match(home,/href="\/diamante\/"/);
 const html=await (await worker.fetch(req('/diamante/'),env)).text();assert.match(html,/<h1>DIAMANTE<\/h1>/);assert.match(html,/href="\/diamante\/etiquetas.xls"/);assert.match(html,/src="\/diamante\/app.js"/);
 const app=await (await worker.fetch(req('/diamante/app.js'),env)).text();assert.match(app,/fetch\('\/diamante\/api\/inventory'/);assert.match(app,/DIAMANTE-Etiquetas.xls/);
});
test('read, save, reset and downloads bind signed calls to their URL catalog',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(u,o)=>{calls.push(JSON.parse(JSON.parse(o.body).body));return Response.json({ok:true,products:[],count:1,value:0,revision:1});});
 for(const name of ['diamante','shunga']){
  await worker.fetch(req('/'+name+'/api/inventory'),env);
  await worker.fetch(req('/'+name+'/api/inventory',{method:'POST',headers:{Origin:'https://shunga.example','Content-Type':'application/json'},body:JSON.stringify({id:'test',value:0,previous:null,revision:0,catalog:'evil'})}),env);
  await worker.fetch(req('/'+name+'/api/reset',{method:'POST',headers:{Origin:'https://shunga.example','Content-Type':'application/json'},body:JSON.stringify({confirmed:true,expected:[{id:'test',previous:null,revision:0}]})}),env);
  const xls=await worker.fetch(req('/'+name+'/etiquetas.xls'),env);assert.match(xls.headers.get('Content-Disposition'),new RegExp(name.toUpperCase()+'-Etiquetas.xls'));
  const pdf=await worker.fetch(req('/'+name+'/faltantes.pdf'),env);assert.match(pdf.headers.get('Content-Disposition'),new RegExp(name.toUpperCase()+'-Faltantes.pdf'));
 }
 assert.deepEqual(calls.map(c=>c.catalog),[...Array(5).fill('diamante'),...Array(5).fill('shunga')]);
});
test('Diamante photos accept only Diamante models and all catalog routes require login',async()=>{
 for(const path of ['/diamante/','/diamante/app.js','/diamante/photos/D006','/diamante/etiquetas.xls','/diamante/faltantes.pdf','/shunga/'])assert.equal((await worker.fetch(new Request('https://shunga.example'+path),env)).status,401);
 const CATALOG={prepare:()=>({bind:()=>({first:async()=>({image_base64:'AA==',mime:'image/webp'})})})};
 assert.equal((await worker.fetch(req('/diamante/photos/D006'),{...env,CATALOG})).status,200);assert.equal((await worker.fetch(req('/diamante/photos/SH140'),{...env,CATALOG})).status,404);
});
