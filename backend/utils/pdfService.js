import PDFDocument from 'pdfkit';

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
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header Branding
      doc
        .fillColor('#1A365D')
        .fontSize(24)
        .text('SUWASEWANA HOSPITAL', { align: 'center' })
        .fontSize(12)
        .fillColor('#4A5568')
        .text('Kandy, Sri Lanka | Tel: +94 81 222 2222 | info@suwasevana.com', { align: 'center' })
        .moveDown(1.5);

      // Horizontal divider line
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1.5);

      // Invoice Title
      doc
        .fillColor('#1A365D')
        .fontSize(18)
        .text('PAYMENT RECEIPT', { align: 'left' })
        .moveDown(1);

      // Metadata section (columns)
      const startY = doc.y;
      
      // Left Column: Patient details
      doc
        .fillColor('#2D3748')
        .fontSize(10)
        .text('PATIENT DETAILS:', 50, startY, { underline: true })
        .moveDown(0.3)
        .text(`Patient ID: ${patient?.patientId || 'N/A'}`)
        .text(`Name: ${patient?.fullName || 'N/A'}`)
        .text(`NIC: ${patient?.nicNumber || 'N/A'}`)
        .text(`Mobile: ${patient?.mobileNumber || 'N/A'}`);

      // Right Column: Receipt details
      const rightColX = 350;
      const receiptNo = bill?.queueNumber || bill?._id || appointment?._id || 'N/A';
      const dateStr = new Date(bill?.date || new Date()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc
        .text('RECEIPT INFORMATION:', rightColX, startY, { underline: true })
        .moveDown(0.3)
        .text(`Receipt Ref No: ${receiptNo}`)
        .text(`Date of Issue: ${dateStr}`)
        .fillColor('#38A169')
        .text(`Payment Status: PAID`)
        .fillColor('#2D3748');

      doc.moveDown(2);

      // Itemized Table Header
      const tableStartY = doc.y + 20;
      doc
        .strokeColor('#E2E8F0')
        .rect(50, tableStartY, 495, 20)
        .fillAndStroke('#EDF2F7', '#E2E8F0');

      doc
        .fillColor('#2D3748')
        .fontSize(10)
        .text('Description', 60, tableStartY + 5)
        .text('Doctor', 200, tableStartY + 5)
        .text('Room', 350, tableStartY + 5)
        .text('Amount (LKR)', 460, tableStartY + 5, { align: 'right', width: 80 });

      // Itemized Table Rows
      const rowY = tableStartY + 25;
      const desc = bill?.title || `Consultation - ${appointment?.doctorName || doctor?.name || 'Doctor'}`;
      const docName = appointment?.doctorName || doctor?.name || 'N/A';
      const room = doctor?.allocatedRoom || 'TBA';
      const amount = bill?.amount || 3500;

      doc
        .fillColor('#4A5568')
        .text(desc, 60, rowY)
        .text(`Dr. ${docName}`, 200, rowY)
        .text(room, 350, rowY)
        .text(amount.toLocaleString('en-US', { minimumFractionDigits: 2 }), 460, rowY, { align: 'right', width: 80 });

      // Total Section
      const totalY = rowY + 30;
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(50, totalY)
        .lineTo(545, totalY)
        .stroke()
        .moveDown(1);

      doc
        .fillColor('#1A365D')
        .fontSize(12)
        .text('Total Paid:', 350, totalY + 10)
        .text(`LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, totalY + 10, { align: 'right', width: 80 });

      // Footer Note
      const footerY = 700;
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke()
        .moveDown(1);

      doc
        .fillColor('#718096')
        .fontSize(9)
        .text('Thank you for choosing Suwasevana Hospital.', 50, footerY + 10, { align: 'center' })
        .text('This is a computer generated document and does not require a physical signature.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
