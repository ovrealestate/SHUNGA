import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export function shortfallRows(products) {
  return products.filter(p => typeof p.shortfall === 'number' && Number.isFinite(p.shortfall) && p.shortfall > 0)
    .map(p => ({description: String(p.name || ''), color: String(p.variant || ''), quantity: p.shortfall}));
}

function clean(value) {
  return String(value).normalize('NFC').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').replace(/[^\x20-\xff]/g, '').trim();
}
function wrap(value, font, size, width) {
  const lines = []; let line = '';
  for (const word of clean(value).split(' ')) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (line) { lines.push(line); line = ''; }
      let fragment = '';
      for (const letter of word) {
        if (font.widthOfTextAtSize(fragment + letter, size) > width) { lines.push(fragment); fragment = ''; }
        fragment += letter;
      }
      line = fragment;
    } else if (!line || font.widthOfTextAtSize(line + ' ' + word, size) <= width) {
      line += (line ? ' ' : '') + word;
    } else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function createShortfallsPdf(products, date = new Date()) {
  const rows = shortfallRows(products);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pink = rgb(211 / 255, 75 / 255, 118 / 255), soft = rgb(252 / 255, 236 / 255, 241 / 255);
  const ink = rgb(.13, .12, .13), muted = rgb(.43, .41, .44), line = rgb(.82, .79, .81);
  const margin = 42, widths = [316, 124, 71], totalWidth = widths.reduce((a,b)=>a+b,0);
  const stamp = date.toLocaleString('es-MX', {timeZone: 'America/Monterrey', dateStyle: 'short', timeStyle: 'short'});
  const total = rows.reduce((n,r)=>n+r.quantity,0);
  let page, y;
  function text(value, x, top, font = regular, size = 10, color = ink) {
    page.drawText(clean(value), {x, y: top, font, size, color});
  }
  function cellBox(x, top, width, height, fill) {
    page.drawRectangle({x, y: top-height, width, height, borderColor: line, borderWidth: .6, ...(fill ? {color:fill} : {})});
  }
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({x:margin, y:797, width:totalWidth, height:4, color:pink});
    text('BEACH & LOVE / SHUNGA', margin, 777, bold, 11, pink);
    text('FALTANTES DE INVENTARIO', margin, 750, bold, 20);
    text('Fuente: Google Sheets - columna H (Faltante)', margin, 729, regular, 9, muted);
    text(stamp + '  |  ' + rows.length + ' variantes  |  ' + total + ' piezas faltantes', margin, 713, regular, 9, muted);
    y = 692; let x = margin;
    ['DESCRIPCIÓN', 'COLOR', 'CANTIDAD'].forEach((label,i)=>{
      cellBox(x,y,widths[i],29,soft); text(label,x+10,y-19,bold,9);x+=widths[i];
    });
    y -= 29;
  }
  newPage();
  for (const [index,row] of rows.entries()) {
    const desc=wrap(row.description,regular,10,widths[0]-20),color=wrap(row.color,regular,10,widths[1]-20);
    const height=Math.max(34,Math.max(desc.length,color.length)*13+20);
    if(y-height<62)newPage();
    let x=margin;
    for(const width of widths){cellBox(x,y,width,height,index%2?rgb(.995,.985,.99):undefined);x+=width;}
    desc.forEach((s,i)=>text(s,margin+10,y-18-i*13));
    color.forEach((s,i)=>text(s,margin+widths[0]+10,y-18-i*13));
    const quantity=String(row.quantity),qw=bold.widthOfTextAtSize(quantity,11);
    text(quantity,margin+widths[0]+widths[1]+(widths[2]-qw)/2,y-19,bold,11);
    y-=height;
  }
  if(!rows.length){cellBox(margin,y,totalWidth,48);text('No hay faltantes mayores que 0 en la columna H.',margin+12,y-28,regular,11);}
  const pages=pdf.getPages();
  for(const [i,p] of pages.entries()){
    page=p;text('BEACH & LOVE / SHUNGA',margin,35,bold,8,muted);
    const footer='Página '+(i+1)+' de '+pages.length;text(footer,595.28-margin-regular.widthOfTextAtSize(footer,8),35,regular,8,muted);
  }
  pdf.setTitle('Beach & Love - SHUNGA - Faltantes');pdf.setAuthor('Beach & Love');pdf.setSubject('Descripción, color y cantidad de faltantes de Google Sheets, columna H');
  return pdf.save();
}
