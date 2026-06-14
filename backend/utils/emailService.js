import nodemailer from 'nodemailer';

// Helper to get transporter
const getTransporter = async () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass }
    });
  }

  // Fallback: If no SMTP credentials provided in env, use a mock/ethereal account or local transporter
  console.log("⚠️ No SMTP credentials configured. Generating Ethereal test account...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } catch (err) {
    console.error("❌ Failed to create Ethereal account, falling back to console logger transporter", err);
    return {
      sendMail: async (mailOptions) => {
        console.log("✉️ MOCK EMAIL SENT:");
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text}`);
        return { messageId: 'mock-message-id', mock: true };
      }
    };
  }
};

/**
 * Sends a booking confirmation email to the patient.
 * @param {string} email - Patient's email address
 * @param {object} appointment - The created appointment details
 * @param {string} doctorRoom - Doctor's allocated room number
 * @param {Buffer} pdfBuffer - Optional PDF receipt attachment
 */
export const sendBookingConfirmation = async (email, appointment, doctorRoom = "TBA", pdfBuffer = null) => {
  if (!email) {
    console.log("⚠️ No email address provided, skipping booking confirmation email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const appDate = new Date(appointment.date);
    const dateStr = appDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = appDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const refNo = appointment.queueNumber ? `${appointment.queueNumber} (ID: ${appointment._id})` : appointment._id;
    const deadline = `${timeStr}, ${dateStr}`;
    const formattedDate = dateStr;
    const formattedTime = timeStr;

    const emailBody = `Reservation Ref No.: ${refNo}
Deadline: ${deadline}

Due Payment (LKR3500)

This Reservation will be confirmed ONLY upon full payment prior to the deadline.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${formattedDate}
Time: ${formattedTime}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasevana Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Suwasevana Hospital - Kandy',
      text: emailBody
    };

    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `Receipt_${appointment.queueNumber || appointment._id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent: ${info.messageId}`);
    
    // Log ethereal preview URL if applicable
    if (info.messageId !== 'mock-message-id') {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) {
        console.log(`🔗 Ethereal Mail Preview URL: ${url}`);
      }
    }
    return info;
  } catch (err) {
    console.error("❌ Error sending booking confirmation email:", err);
  }
};

/**
 * Sends a payment receipt email to the patient with a PDF attachment.
 * @param {string} email - Patient's email address
 * @param {object} bill - The Mongoose Bill document
 * @param {Buffer} pdfBuffer - PDF receipt buffer
 */
export const sendPaymentReceipt = async (email, bill, pdfBuffer) => {
  if (!email) {
    console.log("⚠️ No email address provided, skipping payment receipt email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const dateStr = new Date(bill.date || new Date()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailBody = `Dear Patient,

Thank you for your payment. Please find attached your payment receipt for ${bill.title}.

Hospital: Suwasevana Hospital - Kandy
Receipt Ref No: ${bill._id}
Amount: LKR ${bill.amount.toLocaleString()}
Status: PAID
Date: ${dateStr}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasevana Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: `Suwasevana Hospital - Payment Receipt (Ref: ${bill._id})`,
      text: emailBody,
      attachments: [
        {
          filename: `Receipt_${bill._id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Payment receipt email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending payment receipt email:", err);
  }
};
