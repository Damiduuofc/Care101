import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Palette — kept in sync with the email templates (utils/emailService.js)
// ---------------------------------------------------------------------------
const COLORS = {
  ink: '#111827',
  text: '#374151',
  muted: '#6B7280',
  subtle: '#9CA3AF',
  border: '#E5E7EB',
  success: '#065F46',
  successBg: '#D1FAE5'
};

const HOSPITAL = {
  name: 'Suwasevana Hospital',
  location: 'Kandy, Sri Lanka',
  email: 'support@suwasewana.com',
  phone: '+94 81 222 3223'
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const RIGHT = PAGE.width - MARGIN;

/** Horizontal rule across the content width (or a custom span). */
function hr(doc, y, { color = COLORS.border, width = 0.75, x1 = MARGIN, x2 = RIGHT } = {}) {
  doc.save().strokeColor(color).lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/** Small uppercase label. */
function label(doc, text, x, y, opts = {}) {
  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
    .text(text.toUpperCase(), x, y, { characterSpacing: 0.8, lineBreak: false, ...opts });
}

/** Label/value pair stacked in a column. Returns next y. */
function field(doc, name, value, x, y, width) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(name, x, y, { width: 90, lineBreak: false });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.5).text(String(value), x + 90, y, { width: width - 90 });
  return y + 17;
}

/** Small rounded status pill. */
function pill(doc, text, x, y) {
  doc.font('Helvetica-Bold').fontSize(8);
  const w = doc.widthOfString(text) + 16;
  doc.save().roundedRect(x, y, w, 16, 8).fill(COLORS.successBg).restore();
  doc.fillColor(COLORS.success).font('Helvetica-Bold').fontSize(8)
    .text(text, x, y + 4.5, { width: w, align: 'center', lineBreak: false });
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
  return new Promise(async (resolve, reject) => {
    try {
      // Resolve room from schedule for this specific appointment/bill date
      let room = 'TBA';
      if (doctor) {
        room = doctor.allocatedRoom || 'TBA';
        const targetDate = appointment?.date || bill?.date;
        if (targetDate) {
          try {
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            const ScheduleRequest = mongoose.model('ScheduleRequest');
            const schedule = await ScheduleRequest.findOne({
              doctorId: doctor._id,
              status: 'approved',
              date: { $gte: startOfDay, $lte: endOfDay }
            });
            
            if (schedule && schedule.allocatedRoom) {
              room = schedule.allocatedRoom;
            }
          } catch (err) {
            console.error("Error fetching room from schedule for receipt:", err.message);
          }
        }
      }

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
      const amount = bill?.amount || 3500;
      const amountFmt = amount.toLocaleString('en-US', { minimumFractionDigits: 2 });

      // -----------------------------------------------------------------
      // Letterhead
      // -----------------------------------------------------------------
      let y = MARGIN;
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12).text(HOSPITAL.name, MARGIN, y, { lineBreak: false });
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(HOSPITAL.location, MARGIN, y + 17, { lineBreak: false });

      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
        .text(HOSPITAL.phone, MARGIN, y + 2, { width: CONTENT_WIDTH, align: 'right' })
        .text(HOSPITAL.email, MARGIN, y + 17, { width: CONTENT_WIDTH, align: 'right' });

      y += 46;
      hr(doc, y);
      y += 40;

      // -----------------------------------------------------------------
      // Title
      // -----------------------------------------------------------------
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22).text('Receipt', MARGIN, y, { lineBreak: false });
      pill(doc, 'PAID', MARGIN + doc.widthOfString('Receipt') + 12, y + 5);
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
        .text(`No. ${receiptNo}`, MARGIN, y + 30, { lineBreak: false });

      y += 70;

      // -----------------------------------------------------------------
      // Billed to / Details
      // -----------------------------------------------------------------
      const colW = (CONTENT_WIDTH - 32) / 2;
      const leftX = MARGIN;
      const rightX = MARGIN + colW + 32;

      label(doc, 'Billed to', leftX, y);
      label(doc, 'Details', rightX, y);
      let ly = y + 18;
      let ry = y + 18;

      ly = field(doc, 'Name', patient?.fullName || 'N/A', leftX, ly, colW);
      ly = field(doc, 'Patient ID', patient?.patientId || 'N/A', leftX, ly, colW);
      ly = field(doc, 'NIC', patient?.nicNumber || 'N/A', leftX, ly, colW);
      ly = field(doc, 'Mobile', patient?.mobileNumber || 'N/A', leftX, ly, colW);

      ry = field(doc, 'Receipt no.', receiptNo, rightX, ry, colW);
      ry = field(doc, 'Date issued', dateStr, rightX, ry, colW);
      ry = field(doc, 'Status', 'Paid', rightX, ry, colW);

      y = Math.max(ly, ry) + 36;

      // -----------------------------------------------------------------
      // Line items
      // -----------------------------------------------------------------
      const cDesc = MARGIN;
      const cDoctor = MARGIN + 200;
      const cRoom = MARGIN + 340;
      const amtW = 100;
      const cAmt = RIGHT - amtW;

      label(doc, 'Description', cDesc, y);
      label(doc, 'Doctor', cDoctor, y);
      label(doc, 'Room', cRoom, y);
      label(doc, 'Amount (LKR)', cAmt, y, { width: amtW, align: 'right' });
      y += 16;
      hr(doc, y, { color: COLORS.ink });
      y += 14;

      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10);
      const rowStart = y;
      doc.text(desc, cDesc, rowStart, { width: cDoctor - cDesc - 16 });
      const descBottom = doc.y;
      doc.text(`Dr. ${docName}`, cDoctor, rowStart, { width: cRoom - cDoctor - 16 });
      const docBottom = doc.y;
      doc.text(String(room), cRoom, rowStart, { width: cAmt - cRoom - 16 });
      doc.text(amountFmt, cAmt, rowStart, { width: amtW, align: 'right' });
      y = Math.max(descBottom, docBottom, rowStart + 12) + 14;
      hr(doc, y);

      // -----------------------------------------------------------------
      // Totals
      // -----------------------------------------------------------------
      const totX = RIGHT - 220;
      y += 18;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5).text('Subtotal', totX, y, { lineBreak: false });
      doc.fillColor(COLORS.ink).text(amountFmt, totX, y, { width: 220, align: 'right' });
      y += 22;
      hr(doc, y, { color: COLORS.ink, x1: totX });
      y += 12;
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Total paid', totX, y + 3, { lineBreak: false });
      doc.fontSize(14).text(`LKR ${amountFmt}`, totX, y, { width: 220, align: 'right' });

      // -----------------------------------------------------------------
      // Footer
      // -----------------------------------------------------------------
      const footerY = Math.max(y + 80, PAGE.height - MARGIN - 34);
      hr(doc, footerY);
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5)
        .text(`Thank you for choosing ${HOSPITAL.name}.`, MARGIN, footerY + 12, { lineBreak: false });
      doc.fillColor(COLORS.subtle).fontSize(8)
        .text('Computer-generated receipt. No signature required.', MARGIN, footerY + 12, { width: CONTENT_WIDTH, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
