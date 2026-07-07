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

  if (email.startsWith("walkin-") && email.includes("@care101.com")) {
    console.log("⚠️ Walk-in mock email detected, skipping sending booking confirmation email.");
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

  if (email.startsWith("walkin-") && email.includes("@care101.com")) {
    console.log("⚠️ Walk-in mock email detected, skipping sending payment receipt email.");
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

/**
 * Sends a welcome email to the newly created doctor.
 * @param {string} slmcReg - Doctor's SLMC registration number
 * @param {string} doctorName - Doctor's full name
 * @param {string} password - Doctor's temporary password
 */
export const sendDoctorWelcomeEmail = async (email, doctorName, password, slmcReg) => {
  if (!email) {
    console.log("⚠️ No email address provided, skipping doctor welcome email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const textBody = `Dear Dr. ${doctorName},

Welcome to Suwasewana Kandy Hospital!

Your doctor account has been successfully created by the system administrator. You can now access the Care101 Healthcare Management System using the credentials below.

Login Details:
- SLMC Number: ${slmcReg}
- Temporary Password: ${password}

Download the Care101 App:
Please download the Care101 mobile application from the Google Play Store or the Apple App Store.
After installing the app, sign in using the login credentials provided above.

For security reasons, please log in as soon as possible and change your temporary password after your first login.

If you experience any issues accessing your account, please contact the system administrator for assistance.

Thank you, and welcome to Suwasewana Kandy Hospital. We look forward to working with you.

Kind regards,

Suwasewana Kandy Hospital Administration Team

Email: support@suwasewana.com
Phone: +94 81 222 3223`;

    const htmlBody = `<p>Dear Dr. <strong>${doctorName}</strong>,</p>
<p>Welcome to <strong>Suwasewana Kandy Hospital</strong>!</p>
<p>Your doctor account has been successfully created by the system administrator. You can now access the <strong>Care101 Healthcare Management System</strong> using the credentials below.</p>
<h3>Login Details</h3>
<ul>
  <li><strong>SLMC Number:</strong> ${slmcReg || "N/A"}</li>
  <li><strong>Email:</strong> ${email}</li>
  <li><strong>Temporary Password:</strong> ${password}</li>
</ul>
<h3>Download the Care101 App</h3>
<p>Please download the <strong>Care101</strong> mobile application from the <strong>Google Play Store</strong> or the <strong>Apple App Store</strong>.</p>
<p>After installing the app, sign in using the login credentials provided above.</p>
<p>For security reasons, please log in as soon as possible and change your temporary password after your first login.</p>
<p>If you experience any issues accessing your account, please contact the system administrator for assistance.</p>
<p>Thank you, and welcome to <strong>Suwasewana Kandy Hospital</strong>. We look forward to working with you.</p>
<br/>
<p>Kind regards,</p>
<p><strong>Suwasewana Kandy Hospital Administration Team</strong></p>
<p><strong>Email:</strong> <a href="mailto:support@suwasewana.com">support@suwasewana.com</a><br/>
<strong>Phone:</strong> +94 81 222 3223</p>`;

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasewana Kandy Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Welcome to Suwasewana Kandy Hospital - Doctor Account Created',
      text: textBody,
      html: htmlBody
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Doctor welcome email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending doctor welcome email:", err);
  }
};

/**
 * Sends an account activation/approval email to the doctor.
 * @param {string} email - Doctor's email address
 * @param {string} doctorName - Doctor's full name
 */
export const sendDoctorApprovalEmail = async (email, doctorName) => {
  if (!email) {
    console.log("⚠️ No email address provided, skipping doctor approval email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const textBody = `Dear Dr. ${doctorName},

Your doctor account on the Care101 Healthcare Management System has been approved and activated by the administrator.

You can now log in to the Care101 mobile application or dashboard using your registered credentials.

If you experience any issues accessing your account, please contact the system administrator for assistance.

Thank you, and welcome to Suwasewana Kandy Hospital.

Kind regards,

Suwasewana Kandy Hospital Administration Team

Email: support@suwasewana.com
Phone: +94 81 222 3223`;

    const htmlBody = `<p>Dear Dr. <strong>${doctorName}</strong>,</p>
<p>Your doctor account on the <strong>Care101 Healthcare Management System</strong> has been approved and activated by the administrator.</p>
<p>You can now log in to the <strong>Care101</strong> mobile application or dashboard using your registered credentials.</p>
<p>If you experience any issues accessing your account, please contact the system administrator for assistance.</p>
<p>Thank you, and welcome to <strong>Suwasewana Kandy Hospital</strong>.</p>
<br/>
<p>Kind regards,</p>
<p><strong>Suwasewana Kandy Hospital Administration Team</strong></p>
<p><strong>Email:</strong> <a href="mailto:support@suwasewana.com">support@suwasewana.com</a><br/>
<strong>Phone:</strong> +94 81 222 3223</p>`;

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasewana Kandy Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Care101 - Doctor Account Approved & Activated',
      text: textBody,
      html: htmlBody
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Doctor approval email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending doctor approval email:", err);
  }
};


