import * as XLSX from 'xlsx';

export const LABEL_HEADERS=['Modelo','Color','Talla','Código de barras','Pedido','Precio','Marca','','Costos','Subtotal','Utilidad %'];
const text=v=>String(v??'').trim();
const prefix=(v,n)=>Array.from(text(v)).slice(0,n).join('');
// SheetJS CE's BIFF8 writer omits alignment. Set the horizontal alignment
// in each generated XF record without changing cell values or number formats.
function centerXls(bytes){
 const container=XLSX.CFB.read(new Uint8Array(bytes),{type:'array'});
 const workbook=XLSX.CFB.find(container,'Workbook');
 if(!workbook)throw Error('No se pudo centrar el archivo de etiquetas.');
 const data=workbook.content;
 for(let offset=0;offset+4<=data.length;){
  const type=data[offset]|data[offset+1]<<8,length=data[offset+2]|data[offset+3]<<8;
  if(offset+4+length>data.length)throw Error('Formato XLS inválido.');
  if(type===0x00e0&&length===20)data[offset+10]=(data[offset+10]&0xf8)|2;
  offset+=4+length;
 }
 return new Uint8Array(XLSX.CFB.write(container,{type:'array'}));
}
function amount(v,label){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(label+' inválido en Google Sheets.');
 return v;
}
export function labelRows(products){
 const rows=[];
 for(const p of products){
  if(!Object.hasOwn(p,'shortfall'))throw Error('La conexión necesita actualizarse para leer la columna H.');
  const qty=amount(p.shortfall,'Faltante');
  if(!qty)continue;
  for(const key of ['cost','price','brand'])if(!Object.hasOwn(p,key))throw Error('La conexión necesita actualizarse para leer costo, precio y marca.');
  const cost=amount(p.cost,'Costo'),price=amount(p.price,'Precio público');
  rows.push([text(p.model),prefix(p.variant,3),prefix(p.size,2)||'UN',text(p.id),qty,price,p.brand??85,null,cost,cost===null?null:Math.round((cost*qty+Number.EPSILON)*100)/100,cost===null||price===null||cost===0?null:(price-cost)/cost]);
 }
 return rows;
}
export function createLabelsXls(products){
 const rows=labelRows(products),missing=rows.some(r=>r[9]===null);
 const total=missing?'PENDIENTE COSTO':Math.round(rows.reduce((s,r)=>s+r[9],0)*100)/100;
 const sheet=XLSX.utils.aoa_to_sheet([LABEL_HEADERS,...rows,[null,null,null,null,null,null,null,null,'TOTAL',total,null]]);
 sheet['!cols']=[{wch:15},{wch:9},{wch:9},{wch:22},{wch:12},{wch:15},{wch:20},{wch:5},{wch:15},{wch:23},{wch:15}];
 for(let r=2;r<=rows.length+1;r++){
  for(const c of ['A','B','C','D'])if(sheet[c+r])sheet[c+r].z='@';
  for(const c of ['F','I','J'])if(sheet[c+r])sheet[c+r].z='"$"#,##0.00';
  if(sheet['K'+r])sheet['K'+r].z='0.00%';
 }
 if(typeof total==='number')sheet['J'+(rows.length+2)].z='"$"#,##0.00';
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Etiquetas');
 return centerXls(XLSX.write(book,{type:'array',bookType:'biff8'}));
}
