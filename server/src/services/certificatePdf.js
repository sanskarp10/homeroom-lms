import PDFDocument from 'pdfkit';
import { config } from '../config.js';

const BOARD = '#1F3A33';
const PENCIL = '#F2B632';
const PAPER = '#F6F7F2';
const INK = '#14211D';
const MUTED = '#5C6B66';

/** Stream a landscape A4 certificate into `out` (a writable such as the HTTP response). */
export function writeCertificatePdf(cert, out) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Certificate - ${cert.courseTitle}`, Author: 'Homeroom' } });
  doc.pipe(out);
  const W = doc.page.width;
  const H = doc.page.height;

  doc.rect(0, 0, W, H).fill(PAPER);

  // Chalkboard band with ruled lines, like the edge of a class timetable.
  const band = 190;
  doc.rect(0, 0, band, H).fill(BOARD);
  doc.save().strokeColor('#FFFFFF').opacity(0.08).lineWidth(1);
  for (let y = 48; y < H; y += 34) doc.moveTo(24, y).lineTo(band - 24, y).stroke();
  doc.restore();
  doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(26).text('Homeroom', 28, 44, { width: band - 56 });
  doc.fillColor('#FFFFFF').opacity(0.7).font('Helvetica').fontSize(9.5).text('The online school with live classes', 28, 78, { width: band - 56 }).opacity(1);

  // Seal
  const cx = band / 2;
  const cy = H - 118;
  doc.circle(cx, cy, 52).fill(PENCIL);
  doc.circle(cx, cy, 43).lineWidth(1.2).strokeColor(BOARD).stroke();
  doc.fillColor(BOARD).font('Times-Bold').fontSize(13).text('Completed', cx - 43, cy - 16, { width: 86, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).text(new Date(cert.issuedAt).getFullYear().toString(), cx - 43, cy + 3, { width: 86, align: 'center' });

  // Body
  const x = band + 64;
  const width = W - x - 64;
  doc.rect(band + 28, 28, W - band - 56, H - 56).lineWidth(0.8).strokeColor('#C9D1CC').stroke();

  doc.fillColor(MUTED).font('Helvetica').fontSize(12).text('Certificate of completion', x, 84, { width });
  doc.fillColor(MUTED).fontSize(12).text('This certifies that', x, 132, { width });

  doc.fillColor(INK).font('Times-Bold');
  fitText(doc, cert.studentName, width, 46, 26);
  const nameY = 154;
  doc.text(cert.studentName, x, nameY, { width, lineBreak: false });
  const nameWidth = Math.min(width, doc.widthOfString(cert.studentName));
  const underlineY = nameY + doc.currentLineHeight() + 4;
  doc.rect(x, underlineY, nameWidth, 5).fill(PENCIL);

  doc.fillColor(MUTED).font('Helvetica').fontSize(12).text('has completed every lesson and passed every quiz in', x, underlineY + 30, { width });
  doc.fillColor(INK).font('Times-Bold');
  fitText(doc, cert.courseTitle, width * 1.9, 28, 18); // allow two lines
  doc.text(cert.courseTitle, x, underlineY + 54, { width, height: 80, ellipsis: true });

  // Footer facts
  const footY = H - 150;
  const col = width / 3;
  const fact = (label, value, i) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(label, x + col * i, footY, { width: col - 16 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12.5).text(value, x + col * i, footY + 15, { width: col - 16 });
  };
  fact('Date issued', new Date(cert.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 0);
  fact('Instructor', cert.instructorName || 'Homeroom', 1);
  fact('Course length', `${cert.hours || 1} ${cert.hours === 1 ? 'hour' : 'hours'}`, 2);

  doc.moveTo(x, H - 96).lineTo(x + width, H - 96).lineWidth(0.6).strokeColor('#C9D1CC').stroke();
  const verifyUrl = `${config.clientUrl}/verify/${cert.code}`;
  doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(`Certificate ID ${cert.code}`, x, H - 82, { width: width / 2 });
  doc.text(`Verify at ${verifyUrl}`, x + width / 2, H - 82, { width: width / 2, align: 'right', link: verifyUrl });

  doc.end();
}

function fitText(doc, text, maxWidth, start, min) {
  let size = start;
  doc.fontSize(size);
  while (size > min && doc.widthOfString(text) > maxWidth) doc.fontSize(--size);
}
