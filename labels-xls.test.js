import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {createLabelsXls,labelRows,LABEL_HEADERS} from './labels-xls.js';
const product={model:'SH01',variant:'ROSA',size:null,id:'001234567890123456',shortfall:3,cost:12.35,price:28.9,brand:85};
test('labels use actual H, abbreviations, identifiers as text and the requested nine columns',()=>{
 const bytes=createLabelsXls([product,{...product,shortfall:0},{...product,id:'2',variant:'AZUL',size:'Mediana',shortfall:2,cost:10}]);
 assert.deepEqual(Array.from(bytes.slice(0,8)),[208,207,17,224,161,177,26,225]);
 const book=XLSX.read(bytes,{type:'array'}),sheet=book.Sheets.Etiquetas;
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null});
 assert.deepEqual(rows[0],LABEL_HEADERS);
 assert.deepEqual(rows[1],['SH01','ROS','UN',product.id,3,28.9,85,null,37.05]);
 assert.equal(rows[2][2],'Me');assert.equal(rows[3][8],57.05);assert.equal(sheet.D2.t,'s');
});
test('missing costs stay blank and never produce an understated total',()=>{
 const sheet=XLSX.read(createLabelsXls([{...product,cost:null}]),{type:'array'}).Sheets.Etiquetas;
 assert.equal(sheet.I2,undefined);assert.equal(sheet.I3.v,'PENDIENTE COSTO');
 assert.equal(labelRows([{...product,cost:0}])[0][8],0);
});
test('invalid data fails explicitly and an empty order has a zero total',()=>{
 assert.throws(()=>labelRows([{...product,shortfall:'#VALUE!'}]),/Faltante/);
 assert.throws(()=>labelRows([{...product,price:'$20'}]),/Precio/);
 const sheet=XLSX.read(createLabelsXls([]),{type:'array'}).Sheets.Etiquetas;
 assert.equal(sheet.I2.v,0);
});
