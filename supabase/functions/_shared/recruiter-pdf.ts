import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CONTRACT_TEMPLATES, TEMPLATE_VERSION } from './recruiter-contract-templates.ts';
import { CONTRACT_FONTS } from './recruiter-contract-fonts.ts';
import { contractValues } from './recruiter-contract-data.ts';
import type { RecruiterProfile, DocumentRole } from './recruiter-contract-policy.ts';

export interface GeneratedContract { role: DocumentRole; name: string; bytes: Uint8Array; pages: number }
export async function generateRecruiterContract(id: string, profile: RecruiterProfile, email: string, kind: string): Promise<GeneratedContract[]> {
  const values = contractValues(id, profile, email, kind);
  const result: GeneratedContract[] = [];
  const sections: {role: DocumentRole; name:string; indices:number[]}[]=[];
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
    const fonts: PDFFont[] = [];
    for (const base64 of CONTRACT_FONTS) fonts.push(await doc.embedFont(Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { subset: true }));
    const supported = fonts.map(f => new Set(f.getCharacterSet()));
    const fontFor = (char: string) => { const n = supported.findIndex(set => set.has(char.codePointAt(0)!)); if(n < 0) throw Error(`Das Zeichen „${char}“ kann im Vertrags-PDF noch nicht dargestellt werden. Bitte Matchunt kontaktieren; die Angaben wurden nicht verändert.`); return fonts[n]; };
    const glyphWidths=new Map<string,number>();
    const width = (text: string, size: number) => [...text].reduce((sum,c) => {
      const key=size+':'+c;
      if(!glyphWidths.has(key)) glyphWidths.set(key,fontFor(c).widthOfTextAtSize(c,size));
      return sum+glyphWidths.get(key)!;
    },0);
  for (const template of CONTRACT_TEMPLATES) {
    const firstPage=doc.getPageCount();
    let page: PDFPage, y=0;
    const draw = (text: string, x: number, atY: number, size: number, color = rgb(.10,.22,.18)) => {
      let buffer='', active: PDFFont|undefined;
      const flush = () => { if(buffer && active) { page.drawText(buffer,{x,y:atY,size,font:active,color}); x+=active.widthOfTextAtSize(buffer,size); } buffer=''; };
      for (const c of text) { const font=fontFor(c); if(active!==font) { flush(); active=font; } buffer+=c; } flush();
    };
    const newPage = () => {
      page=doc.addPage([595.28,841.89]); y=771;
      draw('MATCHUNT / RECRUITER',48,809,9); draw(`Fassung ${TEMPLATE_VERSION} · ${template.role}`,365,809,8);
      page.drawLine({start:{x:48,y:44},end:{x:547,y:44},thickness:.5,color:rgb(.8,.85,.82)});
      draw(`Vertrag ${id}`,48,29,7); draw(String(doc.getPageCount()),530,29,8);
    };
    const line = (text: string,size:number) => { if(y < 62+size) newPage(); draw(text,48,y,size); y-=size*1.5; };
    const paragraph = (text:string,size=9.5,after=8) => {
      // Typography is interpreted ONLY in trusted templates, never in personal values.
      if(y < (size>12?120:85)) newPage();
      let current='';
      for(const word of text.split(/\s+/)) {
        if(width(current+(current?' ':'')+word,size)<=499) current+=(current?' ':'')+word;
        else { if(current) line(current,size); current=''; for(const char of word) { if(width(current+char,size)>499) {line(current,size);current='';} current+=char; } }
      }
      if(current) line(current,size); y-=after;
    };
    const substitute = (text:string) => text.replace(/\{\{(\w+)\}\}/g,(_,key:string)=> { if(!(key in values)) throw Error(`Unbekanntes Vertragsfeld: ${key}`); return values[key]; });
    newPage();
    for(const block of template.text.split(/\n\s*\n/)) {
      if(!block.trim() || /^---+$/.test(block.trim())) continue;
      if(block.startsWith('|')) {
        const rows=block.split('\n').filter(l=>!/^\|[\s:|-]+\|$/.test(l)).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()));
        for(const row of rows.slice(1)) { paragraph(row[0],14,7); row.slice(1).forEach((value,n)=>paragraph(`${rows[0][n+1]}: ${value}`,9.5,4)); y-=8; }
      } else {
        for(const raw of block.split('\n')) {
          const heading=/^#+ /.test(raw), size=raw.startsWith('# ')?20:heading?14:9.5;
          const text=substitute(raw.replace(/^#+ /,'').replace(/\*\*/g,'').replace(/^[-*] /,'• '));
          if(/\/(recruiter|matchunt)_sign\//.test(raw)) { if(y<160) newPage(); paragraph(text,10,70); }
          else paragraph(text,size,heading?13:7);
        }
      }
    }
    sections.push({role:template.role,name:template.name,indices:Array.from({length:doc.getPageCount()-firstPage},(_,n)=>firstPage+n)});
  }
  // Embed/subset Unicode fonts once, then split into the seven DocuSign documents.
  const source=await PDFDocument.load(await doc.save());
  for(const section of sections) {
    const part=await PDFDocument.create();
    for(const page of await part.copyPages(source,section.indices)) part.addPage(page);
    part.setTitle(`${section.name.replace('.pdf','')} · ${profile.company}`); part.setAuthor('Matchunt'); part.setSubject(`Vertrag ${id} · Fassung ${TEMPLATE_VERSION}`);
    result.push({role:section.role,name:section.name,bytes:await part.save(),pages:part.getPageCount()});
  }
  return result;
}
export async function combineRecruiterContract(documents: GeneratedContract[]): Promise<Uint8Array> {
  const combined=await PDFDocument.create();
  for(const item of documents) { const source=await PDFDocument.load(item.bytes); for(const page of await combined.copyPages(source,source.getPageIndices())) combined.addPage(page); }
  return combined.save();
}
