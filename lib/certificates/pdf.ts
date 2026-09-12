/**
 * lib/certificates/pdf.ts
 *
 * Spec section 32: certificates need a QR code and the standard fields
 * (participant, competition, category, position, score, certificate ID,
 * issue date, organizer). This renders that as an actual downloadable PDF.
 *
 * Uses pdf-lib's built-in standard fonts (Helvetica family) rather than
 * embedding the app's web fonts (Fraunces/Inter) — embedding custom fonts
 * means fetching font files at request time, which is extra failure surface
 * for a document that needs to reliably generate. The color palette still
 * matches the app (ivory background, pine-teal ink, emerald rule, gold
 * accent for the award line) so it doesn't look like a generic template.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface CertificateData {
  participantName: string;
  competitionName: string;
  categoryName: string;
  position: number | null;
  award: string | null;
  finalScore: number | null;
  certificateCode: string;
  issueDate: string; // ISO date
  organizer?: string | null;
  /** PNG data URL, e.g. from lib/participants/qr.ts's generateVerificationQrDataUrl */
  qrDataUrl: string;
}

// Brand palette as 0-1 RGB (pdf-lib doesn't take hex directly).
const IVORY = rgb(0xfb / 255, 0xf7 / 255, 0xee / 255);
const INK = rgb(0x0f / 255, 0x2a / 255, 0x24 / 255);
const EMERALD = rgb(0x0b / 255, 0x6e / 255, 0x4f / 255);
const GOLD = rgb(0xb0 / 255, 0x8d / 255, 0x57 / 255);
const HAIRLINE = rgb(0xdd / 255, 0xd3 / 255, 0xbe / 255);

function centerText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  const pageWidth = page.getWidth();
  page.drawText(text, { x: (pageWidth - width) / 2, y, size, font, color });
}

export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // landscape A4 in points
  const { width, height } = page.getSize();

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const timesRomanItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Background + border
  page.drawRectangle({ x: 0, y: 0, width, height, color: IVORY });
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: HAIRLINE,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: GOLD,
    borderWidth: 0.75,
  });

  centerText(page, "MUSABAQA", height - 90, helveticaBold, 14, EMERALD);
  centerText(page, "Certificate of " + (data.award ?? "Participation"), height - 130, helveticaBold, 28, INK);

  centerText(page, "This certifies that", height - 190, timesRomanItalic, 14, INK);
  centerText(page, data.participantName, height - 230, helveticaBold, 32, INK);

  const categoryLine = `participated in the "${data.categoryName}" category of ${data.competitionName}`;
  centerText(page, categoryLine, height - 270, helvetica, 13, INK);

  if (data.position != null) {
    centerText(page, `Final position: ${data.position}`, height - 300, helveticaBold, 14, GOLD);
  }
  if (data.finalScore != null) {
    centerText(page, `Score: ${data.finalScore.toFixed(2)}`, height - 320, helvetica, 12, INK);
  }

  // Footer row: certificate code + issue date on the left, organizer center, QR on the right
  const footerY = 70;
  page.drawText(`Certificate ID: ${data.certificateCode}`, { x: 50, y: footerY + 14, size: 10, font: helvetica, color: INK });
  page.drawText(`Issued: ${data.issueDate}`, { x: 50, y: footerY, size: 10, font: helvetica, color: INK });
  if (data.organizer) {
    centerText(page, data.organizer, footerY + 7, helvetica, 10, INK);
  }

  // QR code, bottom-right
  const qrBytes = Buffer.from(data.qrDataUrl.split(",")[1], "base64");
  const qrImage = await doc.embedPng(qrBytes);
  const qrSize = 80;
  page.drawImage(qrImage, { x: width - 50 - qrSize, y: footerY - 5, width: qrSize, height: qrSize });
  page.drawText("Scan to verify", {
    x: width - 50 - qrSize,
    y: footerY - 18,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  return doc.save();
}
