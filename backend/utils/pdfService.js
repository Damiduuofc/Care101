import PDFDocument from 'pdfkit';

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------
const COLORS = {
  navy: '#1A365D',
  navyDark: '#122745',
  teal: '#0D6E6E',
  slate: '#2D3748',
  muted: '#718096',
  faint: '#A0AEC0',
  border: '#E2E8F0',
  panelBg: '#F7FAFC',
  rowAlt: '#F9FBFC',
  success: '#22A06B',
  successBg: '#E6F7EF',
  white: '#FFFFFF'
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2; // 495.28

/** Draws a filled rounded-rectangle "pill" with centered text. Returns nothing. */
function drawPill(doc, { text, x, y, width, height, bg, color, fontSize = 9, bold = true }) {
  doc.save();
  doc.roundedRect(x, y, width, height, height / 2).fill(bg);
  doc
    .fillColor(color)
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fontSize)
    .text(text, x, y + (height - fontSize) / 2 + 1, { width, align: 'center' });
  doc.restore();
}

/** Draws a horizontal divider line spanning the content width at the given y. */
function hr(doc, y, color = COLORS.border, x1 = MARGIN, x2 = PAGE.width - MARGIN) {
  doc.save().strokeColor(color).lineWidth(1).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/**
 * Generates an in-memory PDF receipt/invoice.
 * @param {object} bill - Mongoose Bill document details
 * @param {object} appointment - Mongoose Appointment details
 * @param {object} doctor - Mongoose Doctor details (used for room number)
 * @param {object} patient - Mongoose Patient details (used for name/contact)
 * @returns {Promise<Buffer>} - Returns the generated PDF as a buffer
 */
export const generateReceiptPdf = (bill, appointment, doctor, patient) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Derived values used throughout the layout
      const receiptNo = bill?.queueNumber || bill?._id || appointment?._id || 'N/A';
      const dateStr = new Date(bill?.date || new Date()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const desc = bill?.title || `Consultation - ${appointment?.doctorName || doctor?.name || 'Doctor'}`;
      const docName = appointment?.doctorName || doctor?.name || 'N/A';
      const room = doctor?.allocatedRoom || 'TBA';
      const amount = bill?.amount || 3500;
      const amountFmt = amount.toLocaleString('en-US', { minimumFractionDigits: 2 });

      // -----------------------------------------------------------------
      // Header band
      // -----------------------------------------------------------------
      const headerHeight = 118;
      const gradient = doc.linearGradient(0, 0, PAGE.width, headerHeight);
      gradient.stop(0, COLORS.teal).stop(1, COLORS.navyDark);
      doc.rect(0, 0, PAGE.width, headerHeight).fill(gradient);

      doc
        .fillColor(COLORS.white)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('SUWASEVANA HOSPITAL', MARGIN, 36);

      doc
        .fillColor('#D7F0EE')
        .font('Helvetica')
        .fontSize(10)
        .text('Kandy, Sri Lanka  |  Tel: +94 81 222 2222  |  info@suwasevana.com', MARGIN, 64);

      // Small "receipt" tag in the header, right-aligned
      drawPill(doc, {
        text: 'PAYMENT RECEIPT',
        x: PAGE.width - MARGIN - 160,
        y: 40,
        width: 160,
        height: 24,
        bg: COLORS.navyDark,
        color: COLORS.white,
        fontSize: 9
      });

      let cursorY = headerHeight + 30;

      // -----------------------------------------------------------------
      // Title row: big title + receipt number badge
      // -----------------------------------------------------------------
      doc
        .fillColor(COLORS.navy)
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('Receipt Summary', MARGIN, cursorY);

      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(`Ref No. ${receiptNo}`, MARGIN, cursorY + 24);

      cursorY += 55;

      // -----------------------------------------------------------------
      // Info panel: Patient details (left) / Receipt details (right)
      // -----------------------------------------------------------------
      const panelY = cursorY;
      const panelHeight = 118;
      doc
        .save()
        .roundedRect(MARGIN, panelY, CONTENT_WIDTH, panelHeight, 8)
        .fill(COLORS.panelBg)
        .restore();

      const leftColX = MARGIN + 20;
      const rightColX = MARGIN + CONTENT_WIDTH / 2 + 10;
      const dividerX = MARGIN + CONTENT_WIDTH / 2;

      doc.save().strokeColor(COLORS.border).lineWidth(1)
        .moveTo(dividerX, panelY + 16)
        .lineTo(dividerX, panelY + panelHeight - 16)
        .stroke()
        .restore();

      // Left column — patient details
      let ly = panelY + 18;
      doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(9)
        .text('BILLED TO', leftColX, ly, { characterSpacing: 0.5 });
      ly += 16;
      const patientLines = [
        ['Patient ID', patient?.patientId || 'N/A'],
        ['Name', patient?.fullName || 'N/A'],
        ['NIC', patient?.nicNumber || 'N/A'],
        ['Mobile', patient?.mobileNumber || 'N/A']
      ];
      patientLines.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`${label}`, leftColX, ly, { continued: false });
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.slate).text(value, leftColX + 70, ly);
        ly += 16;
      });

      // Right column — receipt details
      let ry = panelY + 18;
      doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(9)
        .text('RECEIPT DETAILS', rightColX, ry, { characterSpacing: 0.5 });
      ry += 16;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Receipt Ref No.', rightColX, ry);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.slate).text(String(receiptNo), rightColX + 95, ry, { width: 140 });
      ry += 16;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Date of Issue', rightColX, ry);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.slate).text(dateStr, rightColX + 95, ry, { width: 140 });
      ry += 20;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Payment Status', rightColX, ry);
      drawPill(doc, {
        text: 'PAID',
        x: rightColX + 95,
        y: ry - 4,
        width: 60,
        height: 18,
        bg: COLORS.successBg,
        color: COLORS.success,
        fontSize: 8.5
      });

      cursorY = panelY + panelHeight + 35;

      // -----------------------------------------------------------------
      // Itemized table
      // -----------------------------------------------------------------
      const tableX = MARGIN;
      const tableWidth = CONTENT_WIDTH;
      const colDesc = tableX + 12;
      const colDoctor = tableX + 235;
      const colRoom = tableX + 355;
      const colAmountX = tableX + tableWidth - 12 - 90;
      const colAmountWidth = 90;

      // Table header
      const headerRowH = 28;
      doc.save().roundedRect(tableX, cursorY, tableWidth, headerRowH, 6).fill(COLORS.navy).restore();
      // square off the bottom corners of the rounded header so it reads as a flat bar
      doc.save().rect(tableX, cursorY + headerRowH / 2, tableWidth, headerRowH / 2).fill(COLORS.navy).restore();

      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9);
      doc.text('DESCRIPTION', colDesc, cursorY + 9);
      doc.text('DOCTOR', colDoctor, cursorY + 9);
      doc.text('ROOM', colRoom, cursorY + 9);
      doc.text('AMOUNT (LKR)', colAmountX, cursorY + 9, { width: colAmountWidth, align: 'right' });

      cursorY += headerRowH;

      // Single itemized row (alternating-row style kept for future multi-row use)
      const rowH = 34;
      doc.save().rect(tableX, cursorY, tableWidth, rowH).fill(COLORS.rowAlt).restore();
      doc.save().strokeColor(COLORS.border).lineWidth(1)
        .rect(tableX, cursorY, tableWidth, rowH).stroke().restore();

      doc.fillColor(COLORS.slate).font('Helvetica').fontSize(9.5);
      doc.text(desc, colDesc, cursorY + 11, { width: colDoctor - colDesc - 10 });
      doc.text(`Dr. ${docName}`, colDoctor, cursorY + 11, { width: colRoom - colDoctor - 10 });
      doc.text(room, colRoom, cursorY + 11, { width: colAmountX - colRoom - 10 });
      doc.font('Helvetica-Bold').text(amountFmt, colAmountX, cursorY + 11, { width: colAmountWidth, align: 'right' });

      cursorY += rowH + 4;

      hr(doc, cursorY, COLORS.border);
      cursorY += 18;

      // -----------------------------------------------------------------
      // Total section
      // -----------------------------------------------------------------
      const totalBoxWidth = 220;
      const totalBoxX = tableX + tableWidth - totalBoxWidth;
      const totalBoxHeight = 44;
      doc.save().roundedRect(totalBoxX, cursorY, totalBoxWidth, totalBoxHeight, 8).fill(COLORS.teal).restore();

      doc
        .fillColor('#D7F0EE')
        .font('Helvetica')
        .fontSize(9)
        .text('TOTAL PAID', totalBoxX + 18, cursorY + 10);
      doc
        .fillColor(COLORS.white)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(`LKR ${amountFmt}`, totalBoxX + 18, cursorY + 21, { width: totalBoxWidth - 36, align: 'right' });

      // -----------------------------------------------------------------
      // Footer (pinned near the bottom, but never overlapping content above)
      // -----------------------------------------------------------------
      const footerY = Math.max(cursorY + 60, PAGE.height - MARGIN - 55);
      hr(doc, footerY);
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text('Thank you for choosing Suwasevana Hospital.', MARGIN, footerY + 14, { width: CONTENT_WIDTH, align: 'center' });
      doc
        .fillColor(COLORS.faint)
        .fontSize(8)
        .text('This is a computer-generated document and does not require a physical signature.', MARGIN, footerY + 29, { width: CONTENT_WIDTH, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
