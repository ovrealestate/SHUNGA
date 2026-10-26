export const CATEGORIES=['Para ella','Feromonas','Oral','Anal','Lubricantes','Aceites','Para el','Más vendidos'];
const enc=new TextEncoder();
const json=(o,status=200)=>Response.json(o,{status,headers:{'Cache-Control':'no-store'}});
export async function authenticated(req,env){
 if(!env.AUTH_HASH)return false;
 const a=req.headers.get('Authorization')||'';if(!a.startsWith('Basic '))return false;
 let value;try{value=atob(a.slice(6));}catch{return false;}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
 let d=hash.length^env.AUTH_HASH.length;for(let i=0;i<hash.length;i++)d|=hash.charCodeAt(i)^(env.AUTH_HASH.charCodeAt(i)||0);return d===0;
}
async function sheetCall(env,action,payload={}){
 const target=new URL(env.SHEETS_ENDPOINT);
 if(target.protocol!=='https:'||target.hostname!=='script.google.com'||!target.pathname.endsWith('/exec'))throw Error('Conexión de Sheets inválida.');
 const body=JSON.stringify({action,...payload,ts:Date.now(),nonce:crypto.randomUUID()});
 const key=await crypto.subtle.importKey('raw',enc.encode(env.AUTH_HASH),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body)))));
 const r=await fetch(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body,sig}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Google Sheets no confirmó la operación. Actualiza antes de reintentar.');
 let result;try{result=await r.json();}catch{throw Error('Google Sheets necesita completar la autorización de la conexión.');}
 return result;
}
export default {async fetch(req,env){let response;try{response=await route(req,env);}catch(e){response=json({error:e.message||'No se pudo completar la operación.'},502);}const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(response.body,{status:response.status,headers:h});}};
export async function route(req,env){const u=new URL(req.url);
if(!await authenticated(req,env))return new Response('Acceso privado · Beach & Love',{status:401,headers:{'WWW-Authenticate':'Basic realm="Beach & Love SHUNGA", charset="UTF-8"','Cache-Control':'no-store'}});
if(u.pathname.startsWith('/photos/')&&req.method==='GET'){
 const model=u.pathname.slice('/photos/'.length);
 if(!/^SH[0-9]+$/.test(model)||!env.CATALOG)return json({error:'Fotografía no encontrada.'},404);
 const asset=await env.CATALOG.prepare('SELECT image_base64,mime FROM catalog_assets WHERE model=?').bind(model).first();
 if(!asset?.image_base64)return json({error:'Fotografía no disponible.'},404);
 return new Response(Uint8Array.from(atob(asset.image_base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.mime,'Cache-Control':'private, max-age=86400'}});
}
if(u.pathname==='/api/reset'&&req.method==='POST'){
 if(req.headers.get('Origin')!==u.origin||req.headers.get('Content-Type')!=='application/json')return json({error:'Origen inválido.'},403);
 if(!env.SHEETS_ENDPOINT)return json({error:'Google Sheets no está disponible.'},503);
 if(Number(req.headers.get('Content-Length'))>8192)return json({error:'Solicitud demasiado grande.'},413);
 const raw=await req.text();if(raw.length>8192)return json({error:'Solicitud demasiado grande.'},413);
 let body;try{body=JSON.parse(raw);}catch{return json({error:'Solicitud inválida.'},400);}
 if(body.confirmed!==true||!Array.isArray(body.expected)||!body.expected.length||body.expected.length>100)return json({error:'Debes confirmar que todo el inventario se pondrá en 0.'},400);
 if(body.expected.some(p=>typeof p.id!=='string'||!(p.previous===null||(Number.isInteger(p.previous)&&p.previous>=0&&p.previous<=20))||!Number.isInteger(p.revision)||p.revision<0))return json({error:'El inventario cambió. Actualiza antes de reiniciar.'},400);
 const result=await sheetCall(env,'reset',{confirmed:true,expected:body.expected.map(p=>({id:p.id,previous:p.previous,revision:p.revision}))});
 return json(result,result.ok?200:result.conflict?409:502);
}
if(u.pathname==='/api/inventory'&&req.method==='GET'){
 if(!env.SHEETS_ENDPOINT)return json({error:'La conexión con Google Sheets no está disponible.'},503);
 const result=await sheetCall(env,'read');if(!result.ok)throw Error(result.error);
 let catalog=new Map();
 if(env.CATALOG){const data=await env.CATALOG.prepare("SELECT model,info_json,(image_base64 IS NOT NULL AND image_base64!='') AS has_photo FROM catalog_assets").all();catalog=new Map(data.results.map(r=>[r.model,{...JSON.parse(r.info_json),hasPhoto:!!r.has_photo}]));}
 const products=result.products.map(p=>{const c=catalog.get(p.model);return c?{...p,photo:c.hasPhoto?'/photos/'+p.model+(c.photoVersion?'?v='+encodeURIComponent(c.photoVersion):''):p.photo,note:c.photoConfirmed?'':p.note,catalogNote:c.note,catalogPage:c.page}:p;});
 return json({products,live:true,storage:'google-sheets',categories:CATEGORIES});
}
if(u.pathname==='/api/inventory'&&req.method==='POST'){
 if(req.headers.get('Origin')!==u.origin||req.headers.get('Content-Type')!=='application/json')return json({error:'Origen inválido.'},403);
 if(!env.SHEETS_ENDPOINT)return json({error:'No se pudo conectar al inventario. No se confirmó ningún cambio.'},503);
 if(Number(req.headers.get('Content-Length'))>2048)return json({error:'Solicitud demasiado grande.'},413);const raw=await req.text();if(raw.length>2048)return json({error:'Solicitud demasiado grande.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Solicitud inválida.'},400);}
 const valid=n=>n===null||(Number.isInteger(n)&&n>=0&&n<=20);
 if(typeof body.id!=='string'||!valid(body.value)||!valid(body.previous)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'Selecciona una existencia entre 0 y 20.'},400);
 const result=await sheetCall(env,'write',{id:body.id,value:body.value,previous:body.previous,revision:body.revision});return json(result,result.ok?200:result.conflict?409:502);
}
if(u.pathname==='/app.js')return new Response(APP,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
if(u.pathname==='/')return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
return json({error:'Página no encontrada.'},404);
}
const HTML=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHUNGA · Beach & Love</title><style>
:root{color-scheme:light;--ink:#211f20;--pink:#d34b76;--pink-dark:#b52f5b;--pink-light:#fcecf1;--line:#e6e2e4;--muted:#6f6a70}*{box-sizing:border-box}body{margin:0;background:white;color:var(--ink);font:15px Arial,"DejaVu Sans",sans-serif}header,main,footer{max-width:1180px;margin:auto;padding:26px 32px}header{display:flex;justify-content:space-between;gap:20px;align-items:center;border-top:6px solid var(--pink);margin-top:32px;padding-top:22px;padding-bottom:16px}.brand{font-size:14px;font-weight:800;letter-spacing:.04em}.tiny{font-size:12px;color:var(--muted)}header .tiny{text-align:right}.hero{padding:10px 0 28px}.hero .brand{color:var(--pink);font-size:18px;margin-bottom:18px}h1{font-size:clamp(38px,6vw,62px);font-weight:800;letter-spacing:.01em;line-height:1.05;margin:0 0 18px}.subtitle{font-size:clamp(19px,3vw,29px);font-weight:800;margin:0 0 14px}.intro{color:var(--muted);margin:0 0 30px;font-size:15px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.stat{background:var(--pink-light);border-radius:10px;padding:20px 24px}.stat span{display:block;color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.02em}.stats strong{display:block;font-size:38px;font-weight:800;margin-top:12px}.progress{font-size:13px;color:var(--muted);margin:16px 0 0}.notice{padding:15px 18px;background:var(--pink-light);border-radius:7px;font-size:13px;line-height:1.6;margin:0 0 20px}button,.button{display:inline-block;border:1px solid var(--pink);border-radius:6px;background:var(--pink);color:white;padding:12px 18px;font:700 14px Arial,sans-serif;text-decoration:none;cursor:pointer}button:hover:not(:disabled){background:var(--pink-dark);border-color:var(--pink-dark)}button.secondary{background:white;color:var(--pink-dark)}button.secondary:hover:not(:disabled){background:var(--pink-light)}button.danger{color:var(--pink-dark);background:var(--pink-light);border-color:var(--pink)}button.danger:hover:not(:disabled){background:var(--pink-dark);color:white}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f4b3c8;outline-offset:3px}.tools{display:flex;flex-wrap:wrap;gap:12px;align-items:center}input{background:white;border:1px solid var(--line);border-radius:6px;padding:13px;font:inherit;flex:1;min-width:210px}.nav-label{background:#f3f1f3;font-size:12px;font-weight:800;margin-top:24px;padding:13px 15px;border-radius:6px}nav{display:flex;overflow:auto;gap:8px;padding:14px 0 18px;margin-bottom:6px}nav button{white-space:nowrap;background:white;color:var(--ink);border-color:var(--line);font-size:12px;padding:10px 13px}nav button[aria-pressed=true]{background:var(--pink);border-color:var(--pink);color:white}section{margin:28px 0 40px}.section-heading{display:flex;align-items:center;gap:18px;border-bottom:3px solid var(--pink-light);padding-bottom:20px;margin-bottom:24px}.section-number{display:grid;place-items:center;background:var(--pink);color:white;border-radius:10px;min-width:59px;height:54px;font-size:25px;font-weight:800}.section-heading h2{font-size:30px;line-height:1.2;margin:0;text-transform:uppercase;font-weight:800}.section-count{margin-left:auto;align-self:flex-end;color:var(--muted);font-size:13px;text-align:right;padding-bottom:3px}.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}.card{display:grid;grid-template-columns:30% minmax(0,1fr);background:white;border:1px solid var(--line);border-left:6px solid var(--pink);border-radius:0 16px 16px 0;overflow:hidden;min-height:310px}.photo{display:flex;align-items:center;justify-content:center;background:white;padding:26px;min-width:0}.photo img{width:100%;height:280px;object-fit:contain}.placeholder{background:var(--pink-light);color:var(--pink);font-size:12px;text-align:center;padding:22px;border-radius:8px}.placeholder strong{display:block;font-size:23px;margin-bottom:10px}.content{padding:26px 26px 22px 10px;min-width:0}.model{font-size:27px;font-weight:800;letter-spacing:.01em;margin-bottom:13px}.name{font-size:15px;font-weight:800;line-height:1.5;margin:0 0 24px;text-transform:uppercase}.variant-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;margin-bottom:12px}.variant-table th{background:var(--pink-light);text-align:left;font-size:10px;font-weight:800;padding:12px 9px;text-transform:uppercase}.variant-table th:first-child{border-radius:5px 0 0 5px;width:22%}.variant-table th:nth-child(2){width:30%}.variant-table th:nth-child(3){width:13%;text-align:center}.variant-table th:last-child{border-radius:0 5px 5px 0;width:35%}.variant-table td{padding:12px 9px;border-bottom:1px solid var(--line);font-size:12px;vertical-align:top;overflow-wrap:anywhere}.variant-table td.ideal{text-align:center;font-size:14px;font-weight:800}.variant-table td:first-child{font-variant-numeric:tabular-nums}select{font:inherit;background:white;border:1px solid #c8bfc4;border-radius:3px;min-height:38px;width:100%;max-width:130px;padding:7px;color:var(--ink)}.difference{font-size:10px;color:var(--muted);margin-top:6px;line-height:1.4}.catalog-note,.note{font-size:12px;color:var(--muted);line-height:1.5;margin:9px 0}.save-card{margin-top:14px;min-width:140px}.save-status{font-size:12px;line-height:1.6;min-height:19px;margin-top:8px}.empty{padding:26px;background:#faf9fa;border:1px solid var(--line);border-radius:10px;color:var(--muted)}footer{font-size:11px;line-height:1.7;border-top:1px solid var(--line);color:var(--muted);margin-top:30px}footer strong{font-size:11px}dialog{max-width:min(540px,calc(100% - 32px));border:1px solid var(--line);border-radius:12px;padding:28px;color:var(--ink)}dialog::backdrop{background:#23131b88}dialog h2{font:800 25px Arial,sans-serif;margin:0 0 18px}dialog p{font-size:14px;line-height:1.65}.dialog-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;margin-top:20px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:760px){header,main,footer{padding-left:20px;padding-right:20px}header{margin-top:18px}.card{grid-template-columns:32% minmax(0,1fr)}.photo{padding:16px}.photo img{height:220px}.content{padding:22px 18px 18px 4px}.section-count{font-size:11px}.section-heading h2{font-size:25px}.stat{padding:16px}.stats strong{font-size:30px}.variant-table th,.variant-table td{padding-left:6px;padding-right:6px}}@media(max-width:540px){header,main,footer{padding-left:16px;padding-right:16px}.brand{font-size:11px}header .tiny{font-size:9px}.hero{padding-top:0}.hero .brand{font-size:14px}h1{font-size:43px}.subtitle{font-size:20px}.intro{font-size:13px}.stats{gap:8px}.stat{padding:15px 11px}.stat span{font-size:9px}.stats strong{font-size:29px;margin-top:10px}.tools input{min-width:100%;width:100%}.tools button{flex:1;padding-left:10px;padding-right:10px;font-size:12px}.section-heading{gap:12px;flex-wrap:wrap}.section-number{min-width:48px;height:46px;font-size:22px}.section-heading h2{font-size:23px}.section-count{width:100%;margin-left:60px;text-align:left;margin-top:-8px}.card{display:block}.photo{padding:22px 22px 8px}.photo img{height:230px}.content{padding:18px 16px 22px}.model{font-size:25px}.name{font-size:13px;margin-bottom:20px}.variant-table th{font-size:9px}.variant-table td{font-size:11px}.variant-table th:first-child{width:20%}.variant-table th:nth-child(2){width:28%}.variant-table th:nth-child(3){width:14%}.variant-table th:last-child{width:38%}.save-card{width:100%}dialog{padding:22px}.dialog-actions button{flex:1}}
</style><header><div class="brand">BEACH & LOVE</div><div class="tiny">SHUNGA / CATÁLOGO DE INVENTARIO<br>Acceso privado · morelos</div></header><main><div class="hero"><div class="brand">BEACH & LOVE</div><h1>SHUNGA</h1><h2 class="subtitle">CATÁLOGO DE INVENTARIO</h2><p class="intro">Organizado según las categorías de la tienda</p><div class="stats"><div class="stat"><span>Modelos</span><strong id="models">—</strong></div><div class="stat"><span>Variantes</span><strong id="variants">—</strong></div><div class="stat"><span>Piezas ideales</span><strong id="ideal-total">—</strong></div></div><p class="progress"><strong id="counted">—</strong> variantes con existencia física capturada</p></div><div id="notice" class="notice" role="status">Cargando inventario…</div><div class="tools"><label class="sr" for="search">Buscar producto, modelo o código</label><input id="search" type="search" placeholder="Buscar producto, modelo o código…"><button id="refresh" class="secondary">Actualizar</button><button id="reset" class="danger" disabled>Poner todo en 0</button></div><div class="nav-label">ORDEN DE RECORRIDO</div><nav id="categories" aria-label="Categorías"></nav><div id="inventory"></div><dialog id="reset-dialog" aria-labelledby="reset-title"><h2 id="reset-title">¿Poner todo el inventario en 0?</h2><p id="reset-warning"></p><p>Se sustituirán los conteos actuales en Google Sheets y se descartarán los cambios sin guardar. Las categorías y fotografías se conservarán.</p><div class="dialog-actions"><button id="cancel-reset" class="secondary" autofocus>Cancelar</button><button id="confirm-reset" class="danger">Sí, poner todo en 0</button></div></dialog></main><footer><strong>BEACH & LOVE / SHUNGA</strong><br>Existencia ideal = meta · Existencia física = conteo por capturar (0–20). Sin contar = pendiente; 0 = sin unidades.<br>Diseño y fotografías del catálogo proporcionado. Fotografía de SH44 confirmada por Beach & Love.</footer><script type="module" src="/app.js"></script></html>`;
const APP=String.raw`
let state,category='Todas',pending=false;
const drafts=new Map(),statuses=new Map();
const $=s=>document.querySelector(s);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function message(s){$('#notice').textContent=s;}
function summary(){
 $('#models').textContent=new Set(state.products.map(p=>p.model)).size;
 $('#variants').textContent=state.products.length;
 $('#ideal-total').textContent=state.products.reduce((sum,p)=>sum+p.ideal,0);
 $('#counted').textContent=state.products.filter(p=>p.physical!==null).length;
 message(drafts.size?drafts.size+' variante(s) sin guardar. Pulsa Guardar en el cuadro del producto.':(state.storage==='google-sheets'?'Conectado a Google Sheets · columna Existencia física. ':'Inventario conectado. ')+'Selecciona las existencias y pulsa Guardar en cada cuadro.');
}
async function load(){
 try{
  $('#refresh').disabled=true;
  document.querySelectorAll('select,.save-card').forEach(e=>e.disabled=true);
  $('#reset').disabled=true;
  const r=await fetch('/api/inventory',{cache:'no-store'}),data=await r.json();
  if(!r.ok)throw Error(data.error);
  state=data;
  for(const [id,value] of drafts){const p=state.products.find(p=>p.id===id);if(!p||p.physical===value)drafts.delete(id);}
  statuses.clear();summary();render();
 }catch(e){if(state)state.live=false;message(e.message+' Actualiza para volver a conectar.');}
 finally{$('#refresh').disabled=pending;$('#reset').disabled=pending||!state?.live;}
}
async function saveCard(model){
 if(pending||!state.live)return;
 const changed=state.products.filter(p=>p.model===model&&drafts.has(p.id));
 if(!changed.length)return;
 pending=true;statuses.set(model,'Guardando…');render();$('#refresh').disabled=true;
 let saved=0;
 try{
  for(const p of changed){
   const r=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,value:drafts.get(p.id),previous:p.physical,revision:p.revision})});
   const result=await r.json();if(!r.ok)throw Error(result.error);
   p.physical=result.value;p.updated=result.updated;p.revision=result.revision;drafts.delete(p.id);saved++;
  }
  statuses.set(model,'Guardado ✓');
 }catch(e){statuses.set(model,(saved?saved+' variante(s) guardadas. ':'')+e.message+' Los cambios pendientes siguen seleccionados.');}
 finally{pending=false;$('#refresh').disabled=false;summary();render();}
}
function render(){
 $('#reset').disabled=pending||!state.live;
 const nav=$('#categories');nav.replaceChildren();
 for(const c of ['Todas',...state.categories]){
  const b=el('button',c);b.setAttribute('aria-pressed',String(c===category));b.disabled=pending;
  b.onclick=()=>{category=c;render();};nav.append(b);
 }
 const root=$('#inventory');root.replaceChildren();const q=$('#search').value.toLowerCase().trim();
 for(const c of state.categories){
  if(category!=='Todas'&&category!==c)continue;
  const all=state.products.filter(p=>p.category===c),list=all.filter(p=>[p.model,p.name,p.id,p.variant].join(' ').toLowerCase().includes(q));
  if(!list.length&&q)continue;
  const section=el('section'),heading=el('div',undefined,'section-heading');
  heading.append(el('span',String(state.categories.indexOf(c)+1).padStart(2,'0'),'section-number'),el('h2',c),el('span',new Set(all.map(p=>p.model)).size+' modelos · '+all.length+' variantes','section-count'));section.append(heading);
  if(!list.length){section.append(el('p','Sin productos asignados.','empty'));root.append(section);continue;}
  const grid=el('div',undefined,'grid');
  for(const model of [...new Set(list.map(p=>p.model))]){
   const variants=list.filter(p=>p.model===model),first=variants[0],card=el('article',undefined,'card'),photo=el('div',undefined,'photo');card.dataset.model=model;
   const fallback=()=>{photo.replaceChildren();const p=el('div',undefined,'placeholder');p.append(el('strong',model),el('span','Fotografía pendiente'));photo.append(p);};
   if(first.photo){const img=el('img');img.src=first.photo;img.alt=first.name;img.loading='lazy';img.onerror=fallback;photo.append(img);}else fallback();
   card.append(photo);const content=el('div',undefined,'content');content.append(el('div',model,'model'),el('h3',first.name,'name'));
   const table=el('table',undefined,'variant-table');table.setAttribute('aria-label','Variantes de '+model);const thead=el('thead'),head=el('tr');
   for(const label of ['Código','Color / aroma','Ideal','Exist. física']){const th=el('th',label);th.scope='col';head.append(th);}thead.append(head);table.append(thead);const tbody=el('tbody');
   const save=el('button','Guardar','save-card');save.type='button';save.setAttribute('aria-label','Guardar '+model);save.onclick=()=>saveCard(model);
   const status=el('div',statuses.get(model)||'','save-status');status.setAttribute('role','status');
   const updateButton=()=>{save.disabled=pending||!state.live||!state.products.some(p=>p.model===model&&drafts.has(p.id));};
   for(const p of variants){
    const row=el('tr',undefined,'variant');row.append(el('td',p.id),el('td',p.variant),el('td',String(p.ideal),'ideal'));
    const count=el('td'),select=el('select');select.id='count-'+p.id;select.setAttribute('aria-label','Existencia física '+model+' '+p.variant);
    select.append(new Option('Sin contar',''));for(let n=0;n<=20;n++)select.append(new Option(String(n),String(n)));
    const value=drafts.has(p.id)?drafts.get(p.id):p.physical;select.value=value===null?'':String(value);select.disabled=!state.live||pending;
    const diff=el('div',undefined,'difference');
    function updateDifference(){const n=drafts.has(p.id)?drafts.get(p.id):p.physical;diff.textContent=(n===null?'Pendiente de conteo':n<p.ideal?'Faltan '+(p.ideal-n):n>p.ideal?'Sobran '+(n-p.ideal):'Existencia completa')+(drafts.has(p.id)?' · Sin guardar':'');}updateDifference();
    select.onchange=()=>{const n=select.value===''?null:Number(select.value);if(n===p.physical)drafts.delete(p.id);else drafts.set(p.id,n);statuses.delete(model);status.textContent='';updateDifference();updateButton();summary();};
    count.append(select,diff);row.append(count);tbody.append(row);
   }
   table.append(tbody);content.append(table);
   if(first.catalogNote)content.append(el('p',first.catalogNote,'catalog-note'));
   for(const note of [...new Set(variants.map(p=>p.note).filter(Boolean))])content.append(el('p',note,'note'));
   updateButton();content.append(save,status);card.append(content);grid.append(card);
  }
  section.append(grid);root.append(section);
 }
 if(!root.children.length)root.append(el('p','No hay resultados.','empty'));
}
$('#search').oninput=()=>{if(state&&!pending)render();};
$('#refresh').onclick=()=>{if(!pending)load();};
$('#reset').onclick=()=>{
 if(pending||!state?.live)return;
 $('#reset-warning').textContent='Se pondrá en 0 la existencia física de las '+state.products.length+' variantes de TODAS las categorías, aunque tengas una búsqueda o filtro seleccionado.';
 $('#reset-dialog').showModal();$('#cancel-reset').focus();
};
$('#cancel-reset').onclick=()=>$('#reset-dialog').close();
$('#confirm-reset').onclick=async()=>{
 if(pending||!state?.live)return;
 $('#reset-dialog').close();pending=true;render();$('#refresh').disabled=true;
 message('Poniendo todo el inventario en 0…');
 try{
  const r=await fetch('/api/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,expected:state.products.map(p=>({id:p.id,previous:p.physical,revision:p.revision}))})});
  const result=await r.json();if(!r.ok)throw Error(result.error);
  drafts.clear();statuses.clear();await load();message('Se guardó 0 en las '+result.count+' variantes de Google Sheets.');
 }catch(e){message(e.message+' No se confirmó el reinicio. Actualiza para comprobar la hoja.');}
 finally{pending=false;$('#refresh').disabled=false;render();}
};
window.addEventListener('beforeunload',e=>{if(pending||drafts.size){e.preventDefault();e.returnValue='';}});
load();
`;
