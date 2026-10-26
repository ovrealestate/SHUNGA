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
if(u.pathname==='/api/inventory'&&req.method==='GET'){
 if(!env.SHEETS_ENDPOINT)return json({error:'La conexión con Google Sheets no está disponible.'},503);
 const result=await sheetCall(env,'read');if(!result.ok)throw Error(result.error);
 return json({products:result.products,live:true,storage:'google-sheets',categories:CATEGORIES});
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
:root{color-scheme:light;--ink:#222d2a;--green:#284b40;--cream:#f5f3ed;--line:#dedfd5}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:15px system-ui,sans-serif}header,main,footer{max-width:1240px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line)}.brand{letter-spacing:.22em;font-size:13px}.tiny{font-size:12px;color:#61706a}.hero{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:18px 0 28px}h1{font:clamp(36px,6vw,64px) Georgia,serif;margin:8px 0}h2{font:30px Georgia,serif;margin:32px 0 16px}p{line-height:1.6}.stats{display:flex;gap:30px}.stats strong{display:block;font:30px Georgia,serif}.notice{padding:16px 20px;background:#e8ecdf;border:1px solid #d3dbc8;border-radius:8px;font-size:13px;line-height:1.6;margin-bottom:24px}button,.button{display:inline-block;border:1px solid var(--green);border-radius:6px;background:var(--green);color:white;padding:11px 16px;font:inherit;text-decoration:none;cursor:pointer}button.secondary,.button.secondary{background:transparent;color:var(--green)}button:disabled{opacity:.5;cursor:default}.tools{display:flex;flex-wrap:wrap;gap:12px;align-items:center}input{background:white;border:1px solid var(--line);border-radius:6px;padding:13px;font:inherit;flex:1;min-width:220px}nav{display:flex;overflow:auto;gap:8px;margin:18px 0 24px;padding-bottom:8px}nav button{white-space:nowrap;background:transparent;color:var(--green);border-color:var(--line)}nav button[aria-pressed=true]{background:var(--green);color:white}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;break-inside:avoid}.photo{height:185px;background:#fff;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #eee;position:relative}.photo img{width:100%;height:100%;object-fit:contain;padding:14px}.placeholder{color:#78817c;text-align:center;font-size:12px}.placeholder strong{display:block;font:30px Georgia,serif;color:#a2ada5}.content{padding:20px}.model{font-size:11px;letter-spacing:.14em;color:#6b7c72}.name{font-size:15px;line-height:1.4;min-height:40px;margin:7px 0 16px}.variant{border-top:1px solid #e9eae3;padding-top:12px;margin-top:12px}.variant-top{display:flex;justify-content:space-between;gap:8px}.variant small{color:#66736b}.count{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}select{padding:9px;border:1px solid #b4c1b6;border-radius:5px;font:inherit;background:white;min-width:90px}.difference{font-size:12px;color:#7b4f2a;min-height:18px;margin-top:6px}.note{font-size:11px;color:#68736e;margin-top:9px}.save-card{width:100%;margin-top:18px}.save-status{font-size:12px;min-height:18px;margin-top:6px}.empty{padding:25px;border:1px dashed #b5c0b6}.print-only{display:none}footer{font-size:12px;border-top:1px solid var(--line);color:#63736a}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{align-items:start;flex-direction:column}.stats{gap:28px}}@media(max-width:560px){header,main,footer{padding:20px}.grid{grid-template-columns:1fr}.photo{height:180px}.brand{font-size:10px}header .button{font-size:12px}.tools button{width:100%}}@media print{body{background:white;font-size:10px}header,main,footer{padding:8px;max-width:none}nav,.tools,.notice,#login,.save-card{width:100%;margin-top:18px}.save-status{display:none!important}.hero{margin:8px 0}h1{font-size:30px}h2{font-size:22px;break-after:avoid}.stats strong{font-size:20px}.grid{display:block;columns:2;column-gap:15px}.card{display:inline-block;width:100%;margin-bottom:12px;border-radius:0}.photo{height:95px}.content{padding:10px}.name{min-height:0;font-size:12px;margin:5px 0}.variant{padding-top:6px;margin-top:6px}.count{margin-top:5px}select{appearance:none;border:0;padding:0;font-size:11px}.note{font-size:9px}.print-only{display:block}footer{margin-top:12px}@page{size:A4;margin:12mm}}
</style><header><div><div class="brand">BEACH & LOVE</div><div class="tiny">Colección SHUNGA</div></div><span class="tiny">Acceso privado · morelos</span></header><main><div class="hero"><div><div class="tiny">CONTROL DE INVENTARIO</div><h1>Cada detalle cuenta.</h1><p>Tu colección, ordenada como la tienes en tienda.</p></div><div class="stats"><div><strong id="models">—</strong><span>modelos</span></div><div><strong id="variants">—</strong><span>variantes</span></div><div><strong id="counted">—</strong><span>contadas</span></div></div></div><div id="notice" class="notice" role="status">Cargando inventario…</div><div class="tools"><label class="sr" for="search">Buscar producto, modelo o código</label><input id="search" type="search" placeholder="Buscar producto, modelo o código…"><button id="refresh" class="secondary">Actualizar</button></div><nav id="categories" aria-label="Categorías"></nav><div id="inventory"></div></main><footer>Beach & Love · SHUNGA · Las existencias vacías significan pendiente de conteo. Cero significa sin unidades.<br>Fotografías pendientes de recuperar del catálogo original.</footer><script type="module" src="/app.js"></script></html>`;
const APP=String.raw`
let state,category='Todas',pending=false;
const drafts=new Map(),statuses=new Map();
const $=s=>document.querySelector(s);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function message(s){$('#notice').textContent=s;}
function summary(){
 $('#models').textContent=new Set(state.products.map(p=>p.model)).size;
 $('#variants').textContent=state.products.length;
 $('#counted').textContent=state.products.filter(p=>p.physical!==null).length;
 message(drafts.size?drafts.size+' variante(s) sin guardar. Pulsa Guardar en el cuadro del producto.':(state.storage==='google-sheets'?'Conectado a Google Sheets · columna Existencia física. ':'Inventario conectado. ')+'Selecciona las existencias y pulsa Guardar en cada cuadro.');
}
async function load(){
 try{
  $('#refresh').disabled=true;
  document.querySelectorAll('select,.save-card').forEach(e=>e.disabled=true);
  const r=await fetch('/api/inventory',{cache:'no-store'}),data=await r.json();
  if(!r.ok)throw Error(data.error);
  state=data;
  for(const [id,value] of drafts){const p=state.products.find(p=>p.id===id);if(!p||p.physical===value)drafts.delete(id);}
  statuses.clear();summary();render();
 }catch(e){if(state)state.live=false;message(e.message+' Actualiza para volver a conectar.');}
 finally{$('#refresh').disabled=false;}
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
 const nav=$('#categories');nav.replaceChildren();
 for(const c of ['Todas',...state.categories]){
  const b=el('button',c);b.setAttribute('aria-pressed',String(c===category));b.disabled=pending;
  b.onclick=()=>{category=c;render();};nav.append(b);
 }
 const root=$('#inventory');root.replaceChildren();const q=$('#search').value.toLowerCase().trim();
 for(const c of state.categories){
  if(category!=='Todas'&&category!==c)continue;
  const list=state.products.filter(p=>p.category===c&&[p.model,p.name,p.id,p.variant].join(' ').toLowerCase().includes(q));
  if(!list.length){if(category===c)root.append(el('h2',c),el('p','No hay productos asignados a esta categoría.','empty'));continue;}
  const section=el('section');section.append(el('h2',c));const grid=el('div',undefined,'grid');
  for(const model of [...new Set(list.map(p=>p.model))]){
   const variants=list.filter(p=>p.model===model),first=variants[0],card=el('article',undefined,'card'),photo=el('div',undefined,'photo');
   card.dataset.model=model;
   const fallback=()=>{photo.replaceChildren();const p=el('div',undefined,'placeholder');p.append(el('strong',model),el('span','Fotografía pendiente'));photo.append(p);};
   if(first.photo){const img=el('img');img.src=first.photo;img.alt=first.name;img.loading='lazy';img.onerror=fallback;photo.append(img);}else fallback();
   card.append(photo);const content=el('div',undefined,'content');content.append(el('div',model,'model'),el('h3',first.name,'name'));
   const save=el('button','Guardar','save-card');save.type='button';save.setAttribute('aria-label','Guardar '+model);save.onclick=()=>saveCard(model);
   const status=el('div',statuses.get(model)||'','save-status');status.setAttribute('role','status');
   const updateButton=()=>{save.disabled=pending||!state.live||!state.products.some(p=>p.model===model&&drafts.has(p.id));};
   for(const p of variants){
    const box=el('div',undefined,'variant'),top=el('div',undefined,'variant-top');top.append(el('strong',p.variant),el('small','#'+p.id));box.append(top);
    const count=el('div',undefined,'count'),label=el('label','Existencia física'),select=el('select');
    select.id='count-'+p.id;label.htmlFor=select.id;select.setAttribute('aria-label','Existencia física '+model+' '+p.variant);
    select.append(new Option('Sin contar',''));for(let n=0;n<=20;n++)select.append(new Option(String(n),String(n)));
    const value=drafts.has(p.id)?drafts.get(p.id):p.physical;select.value=value===null?'':String(value);select.disabled=!state.live||pending;
    count.append(label,select);box.append(count,el('small','Ideal: '+p.ideal+' unidades'));
    const diff=el('div',undefined,'difference');
    function updateDifference(){const n=drafts.has(p.id)?drafts.get(p.id):p.physical;diff.textContent=(n===null?'Pendiente de conteo':n<p.ideal?'Faltan '+(p.ideal-n):n>p.ideal?'Sobran '+(n-p.ideal):'Existencia completa')+(drafts.has(p.id)?' · Sin guardar':'');}
    updateDifference();
    select.onchange=()=>{const n=select.value===''?null:Number(select.value);if(n===p.physical)drafts.delete(p.id);else drafts.set(p.id,n);statuses.delete(model);status.textContent='';updateDifference();updateButton();summary();};
    box.append(diff);if(p.note)box.append(el('div',p.note,'note'));content.append(box);
   }
   updateButton();content.append(save,status);card.append(content);grid.append(card);
  }
  section.append(grid);root.append(section);
 }
 if(!root.children.length)root.append(el('p','No hay resultados.','empty'));
}
$('#search').oninput=()=>{if(state&&!pending)render();};
$('#refresh').onclick=()=>{if(!pending)load();};
window.addEventListener('beforeunload',e=>{if(pending||drafts.size){e.preventDefault();e.returnValue='';}});
load();
`;
