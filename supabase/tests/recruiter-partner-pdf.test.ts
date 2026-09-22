import { PDFDocument } from 'pdf-lib';
import { generatePartnerCertificate, qrMatrix, qrSvg } from '../functions/_shared/recruiter-partner-pdf.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };

Deno.test('the certificate is one landscape A4 page with the partner data and a QR code', async () => {
  const bytes = await generatePartnerCertificate({
    name: 'Marko Beňko', company: 'Bluewater & Bridge GmbH', number: 'MP-7K3Q-92XW', since: '2026-09-21T15:30:00Z', tier: 'partner', issuedAt: '2026-09-22T10:00:00Z',
  });
  assert(new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-');
  const doc = await PDFDocument.load(bytes);
  assert(doc.getPageCount() === 1);
  const { width, height } = doc.getPage(0).getSize();
  assert(Math.round(width) === 842 && Math.round(height) === 595, `${width} × ${height}`);
  assert(doc.getTitle() === 'Matchunt Partner · Marko Beňko' && doc.getSubject() === 'Partnerzertifikat MP-7K3Q-92XW');
  // Ein Zeichen ohne Schrift macht die Urkunde nicht kaputt.
  await generatePartnerCertificate({ name: 'Test 漢字', company: '', number: 'MP-7K3Q-92XW', since: '2026-09-21T15:30:00Z', tier: 'gold', issuedAt: '2026-09-22T10:00:00Z' });
});

Deno.test('the QR code points to the check page and keeps the quiet zone', () => {
  const m = qrMatrix('https://matchunt.ai/partner/MP-7K3Q-92XW');
  assert(m.length >= 25 && m.every(r => r.length === m.length));
  assert(m[0][0] && m[0][6] && m[6][0], 'finder pattern top left');
  const svg = qrSvg('https://matchunt.ai/partner/MP-7K3Q-92XW');
  assert(svg.startsWith('<svg') && svg.includes(`viewBox="0 0 ${m.length + 8} ${m.length + 8}"`) && svg.includes('fill="#ffffff"'));
});
