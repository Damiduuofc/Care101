import nodemailer from 'nodemailer';
import HttpSms from 'httpsms';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

// Helper to format phone number to E.164
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+94' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
};

// Helper to send SMS via httpSMS
const sendSms = async (to, content) => {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;

  if (!apiKey || !from || apiKey === 'your_httpsms_api_key_here' || from === 'your_httpsms_from_number_here') {
    console.log("⚠️ httpSMS configuration missing or placeholder detected, skipping SMS send.");
    return false;
  }

  const formattedTo = formatPhoneNumber(to);
  const formattedFrom = formatPhoneNumber(from);
  if (!formattedTo) {
    console.log("⚠️ Recipient phone number is invalid, skipping SMS send.");
    return false;
  }
  if (!formattedFrom) {
    console.log("⚠️ Sender phone number is invalid, skipping SMS send.");
    return false;
  }

  try {
    const client = new HttpSms(apiKey);
    console.log(`✉️ Sending SMS to ${formattedTo}...`);
    const message = await client.messages.postSend({
      content,
      from: formattedFrom,
      to: formattedTo
    });
    console.log(`✅ SMS sent successfully: ${message.id}`);
    return true;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    console.error(`❌ Error sending SMS via httpSMS (Status: ${status || 'Unknown'}):`, message);
    return false;
  }
};


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

// ---------------------------------------------------------------------------
// Shared brand styling for all outgoing emails
// ---------------------------------------------------------------------------
const BRAND = {
  name: 'Suwasevana Hospital',
  tagline: 'Kandy',
  primary: '#0946f0',
  primaryDark: '#0a5757',
  accent: '#e8f6f5',
  text: '#2b2b2b',
  muted: '#6b7280',
  border: '#e5e7eb',
  supportEmail: 'support@suwasewana.com',
  supportPhone: '+94 81 222 3223'
};

/**
 * Wraps inner HTML content in a consistent, responsive email shell:
 * header banner, white content card, and footer with contact details.
 */
const renderEmailShell = ({ preheader = '', heading, subheading, bodyHtml, accentColor = BRAND.primary }) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${BRAND.name}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f5f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 1px 4px rgba(16,24,40,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${accentColor} 0%, ${BRAND.primaryDark} 100%); padding: 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:0.2px;">
                      ${BRAND.name}
                    </div>
                    <div style="font-size:13px; color:#d7f0ee; margin-top:2px;">
                      ${BRAND.tagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <h1 style="margin:0; font-size:20px; line-height:1.35; color:${BRAND.text}; font-weight:700;">
                ${heading}
              </h1>
              ${subheading ? `<p style="margin:8px 0 0 0; font-size:14px; color:${BRAND.muted};">${subheading}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 20px 32px 8px 32px; font-size:14px; line-height:1.6; color:${BRAND.text};">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 32px 0 32px;">
              <div style="border-top:1px solid ${BRAND.border};"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 28px 32px;">
              <p style="margin:0 0 4px 0; font-size:13px; color:${BRAND.muted};">
                Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.
              </p>
              <p style="margin:16px 0 0 0; font-size:12px; color:${BRAND.muted};">
                Need help? Contact us at
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary}; text-decoration:none;">${BRAND.supportEmail}</a>
                or call ${BRAND.supportPhone}.
              </p>
              <p style="margin:12px 0 0 0; font-size:11px; color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/** Renders a simple two-column info row for use inside detail cards */
const infoRow = (label, value) => `
  <tr>
    <td style="padding:6px 0; font-size:13px; color:${BRAND.muted}; width:42%; vertical-align:top;">${label}</td>
    <td style="padding:6px 0; font-size:13px; color:${BRAND.text}; font-weight:600; vertical-align:top;">${value}</td>
  </tr>
`;

/** Renders a bordered card container used for reservation/receipt details */
const detailCard = (rowsHtml) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.accent}; border-radius:8px; padding:16px 18px; margin: 4px 0 16px 0;">
    ${rowsHtml}
  </table>
`;

/**
 * Sends a booking confirmation email to the patient.
 * @param {string} email - Patient's email address
 * @param {object} appointment - The created appointment details
 * @param {string} doctorRoom - Doctor's allocated room number
 * @param {Buffer} pdfBuffer - Optional PDF receipt attachment
 */
export const sendBookingConfirmation = async (email, appointment, doctorRoom = "TBA", pdfBuffer = null) => {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

  if (hasSmsConfig) {
    try {
      let phone = null;
      if (appointment && appointment.patientId) {
        if (appointment.patientId.mobileNumber) {
          phone = appointment.patientId.mobileNumber;
        } else {
          const patientObj = await Patient.findById(appointment.patientId);
          if (patientObj) {
            phone = patientObj.mobileNumber;
          }
        }
      }

      if (phone) {
        const appDate = new Date(appointment.date);
        const dateStr = appDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = appDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const refNo = appointment.queueNumber ? `${appointment.queueNumber} (ID: ${appointment._id})` : appointment._id;
        const deadline = `${timeStr}, ${dateStr}`;

        const textBody = `Reservation Ref No.: ${refNo}
Deadline: ${deadline}

Due Payment (LKR3500)

This Reservation will be confirmed ONLY upon full payment prior to the deadline.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${dateStr}
Time: ${timeStr}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

        await sendSms(phone, textBody);
      }
    } catch (smsErr) {
      console.error("❌ SMS booking confirmation failed, falling back to email:", smsErr);
    }
  }

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

    const textBody = `Reservation Ref No.: ${refNo}
Deadline: ${deadline}

Due Payment (LKR3500)

This Reservation will be confirmed ONLY upon full payment prior to the deadline.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${formattedDate}
Time: ${formattedTime}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Your appointment reservation has been received. Please complete payment before the deadline below to confirm your booking.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:14px 16px; margin-bottom:18px;">
        <tr>
          <td style="font-size:13px; color:#9a3412;">
            <strong>⏰ Payment Deadline:</strong> ${deadline}<br/>
            This reservation will be confirmed <strong>only</strong> upon full payment prior to the deadline.
          </td>
        </tr>
      </table>

      <h3 style="margin:0 0 8px 0; font-size:14px; color:${BRAND.text};">Reservation Details</h3>
      ${detailCard(
        infoRow('Reference No.', refNo) +
        infoRow('Doctor', `Dr. ${appointment.doctorName}`) +
        infoRow('Room No.', doctorRoom || 'TBA') +
        infoRow('Hospital', 'Suwasevana Hospital - Kandy') +
        infoRow('Date', formattedDate) +
        infoRow('Time', formattedTime)
      )}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.primary}; border-radius:8px; padding:14px 16px;">
        <tr>
          <td style="font-size:14px; color:#ffffff; font-weight:700;">
            Due Payment: LKR 3,500
          </td>
        </tr>
      </table>
    `;

    const html = renderEmailShell({
      preheader: `Your reservation ${refNo} is pending payment before ${deadline}.`,
      heading: 'Reservation Received — Payment Pending',
      subheading: 'Please review your appointment details below.',
      bodyHtml
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasevana Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Suwasevana Hospital - Kandy',
      text: textBody,
      html
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
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

  const dateStr = new Date(bill.date || new Date()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const textBody = `Dear Patient,

Thank you for your payment. Please find attached your payment receipt for ${bill.title}.

Hospital: Suwasevana Hospital - Kandy
Receipt Ref No: ${bill._id}
Amount: LKR ${bill.amount.toLocaleString()}
Status: PAID
Date: ${dateStr}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

  if (hasSmsConfig) {
    try {
      let phone = null;
      if (bill && bill.patientId) {
        if (bill.patientId.mobileNumber) {
          phone = bill.patientId.mobileNumber;
        } else {
          const patientObj = await Patient.findById(bill.patientId);
          if (patientObj) {
            phone = patientObj.mobileNumber;
          }
        }
      }

      if (phone) {
        await sendSms(phone, textBody);
      }
    } catch (smsErr) {
      console.error("❌ SMS payment receipt failed:", smsErr);
    }
  }

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

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear Patient,</p>
      <p style="margin:0 0 16px 0;">Thank you for your payment. Your receipt for <strong>${bill.title}</strong> is attached to this email as a PDF.</p>

      <h3 style="margin:0 0 8px 0; font-size:14px; color:${BRAND.text};">Payment Summary</h3>
      ${detailCard(
        infoRow('Hospital', 'Suwasevana Hospital - Kandy') +
        infoRow('Receipt Ref No.', bill._id) +
        infoRow('Date', dateStr)
      )}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:14px 16px;">
        <tr>
          <td style="font-size:14px; color:#065f46;">
            <strong>Amount Paid:</strong> LKR ${bill.amount.toLocaleString()}<br/>
            <strong>Status:</strong> ✅ PAID
          </td>
        </tr>
      </table>
    `;

    const html = renderEmailShell({
      preheader: `Your payment of LKR ${bill.amount.toLocaleString()} for ${bill.title} was received.`,
      heading: 'Payment Received — Thank You',
      subheading: 'A copy of your receipt is attached to this email.',
      bodyHtml,
      accentColor: '#0d8a6e'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasevana Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: `Suwasevana Hospital - Payment Receipt (Ref: ${bill._id})`,
      text: textBody,
      html,
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
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

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

  if (hasSmsConfig) {
    try {
      const doctorObj = await Doctor.findOne({ email });
      if (doctorObj && doctorObj.phone) {
        await sendSms(doctorObj.phone, textBody);
      }
    } catch (smsErr) {
      console.error("❌ SMS doctor welcome email failed, falling back to email:", smsErr);
    }
  }

  if (!email) {
    console.log("⚠️ No email address provided, skipping doctor welcome email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear Dr. ${doctorName},</p>
      <p style="margin:0 0 16px 0;">Welcome to <strong>Suwasewana Kandy Hospital</strong>! Your doctor account has been successfully created by the system administrator. You can now access the <strong>Care101 Healthcare Management System</strong> using the credentials below.</p>

      <h3 style="margin:0 0 8px 0; font-size:14px; color:${BRAND.text};">Login Details</h3>
      ${detailCard(
        infoRow('SLMC Number', slmcReg || 'N/A') +
        infoRow('Email', email) +
        infoRow('Temporary Password', `<span style="font-family: 'Courier New', monospace; background:#ffffff; padding:2px 8px; border-radius:4px; border:1px solid ${BRAND.border};">${password}</span>`)
      )}

      <h3 style="margin:0 0 8px 0; font-size:14px; color:${BRAND.text};">Get Started</h3>
      <p style="margin:0 0 16px 0;">Download the <strong>Care101</strong> mobile app from the Google Play Store or Apple App Store, then sign in using the credentials above.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:14px 16px; margin-bottom:16px;">
        <tr>
          <td style="font-size:13px; color:#9a3412;">
            🔒 For security reasons, please log in as soon as possible and change your temporary password after your first login.
          </td>
        </tr>
      </table>

      <p style="margin:0;">If you experience any issues accessing your account, please contact the system administrator for assistance.</p>
      <p style="margin:16px 0 0 0;">Thank you, and welcome aboard. We look forward to working with you.</p>
      <p style="margin:20px 0 0 0;">Kind regards,<br/><strong>Suwasewana Kandy Hospital Administration Team</strong></p>
    `;

    const html = renderEmailShell({
      preheader: `Your Care101 doctor account has been created. Login details inside.`,
      heading: 'Welcome to Suwasewana Kandy Hospital',
      subheading: 'Your doctor account is ready.',
      bodyHtml
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasewana Kandy Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Welcome to Suwasewana Kandy Hospital - Doctor Account Created',
      text: textBody,
      html
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
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

  const textBody = `Dear Dr. ${doctorName},

Your doctor account on the Care101 Healthcare Management System has been approved and activated by the administrator.

You can now log in to the Care101 mobile application or dashboard using your registered credentials.

If you experience any issues accessing your account, please contact the system administrator for assistance.

Thank you, and welcome to Suwasewana Kandy Hospital.

Kind regards,

Suwasewana Kandy Hospital Administration Team

Email: support@suwasewana.com
Phone: +94 81 222 3223`;

  if (hasSmsConfig) {
    try {
      const doctorObj = await Doctor.findOne({ email });
      if (doctorObj && doctorObj.phone) {
        await sendSms(doctorObj.phone, textBody);
      }
    } catch (smsErr) {
      console.error("❌ SMS doctor approval email failed, falling back to email:", smsErr);
    }
  }

  if (!email) {
    console.log("⚠️ No email address provided, skipping doctor approval email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear Dr. ${doctorName},</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:14px 16px; margin-bottom:18px;">
        <tr>
          <td style="font-size:14px; color:#065f46;">
            ✅ Your doctor account on the <strong>Care101 Healthcare Management System</strong> has been approved and activated by the administrator.
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px 0;">You can now log in to the Care101 mobile application or dashboard using your registered credentials.</p>
      <p style="margin:0 0 16px 0;">If you experience any issues accessing your account, please contact the system administrator for assistance.</p>
      <p style="margin:0;">Thank you, and welcome to Suwasewana Kandy Hospital.</p>
      <p style="margin:20px 0 0 0;">Kind regards,<br/><strong>Suwasewana Kandy Hospital Administration Team</strong></p>
    `;

    const html = renderEmailShell({
      preheader: `Your Care101 doctor account has been approved and activated.`,
      heading: 'Account Approved & Activated',
      subheading: 'You now have full access to Care101.',
      bodyHtml,
      accentColor: '#0d8a6e'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Suwasewana Kandy Hospital" <no-reply@suwasevana.com>',
      to: email,
      subject: 'Care101 - Doctor Account Approved & Activated',
      text: textBody,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Doctor approval email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending doctor approval email:", err);
  }
};

/**
 * Sends a welcome notification to a newly registered patient.
 * @param {object} patient - Patient document
 */
export const sendPatientWelcomeEmail = async (patient) => {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

  const textBody = `Hello ${patient.fullName},

Welcome to Care101! Your patient account has been successfully created.

Your Patient ID is: ${patient.patientId}

You should use this Patient ID (along with your password) to log in to the Care101 mobile application.

Best regards,
The Care101 Team`;

  if (hasSmsConfig && patient.mobileNumber) {
    try {
      await sendSms(patient.mobileNumber, textBody);
    } catch (smsErr) {
      console.error("❌ SMS patient welcome failed, falling back to email:", smsErr);
    }
  }

  if (!patient.email) {
    console.log("⚠️ No email address provided, skipping welcome email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hello ${patient.fullName},</p>
      <p style="margin:0 0 16px 0;">Welcome to Care101! Your patient account has been successfully created.</p>
      
      <h3 style="margin:0 0 8px 0; font-size:14px; color:${BRAND.text};">Account Information</h3>
      ${detailCard(
        infoRow('Patient ID', patient.patientId) +
        infoRow('Full Name', patient.fullName) +
        infoRow('Email', patient.email || 'N/A')
      )}
      
      <p style="margin:0 0 16px 0;">You should use this Patient ID (along with your password) to log in to the Care101 mobile application.</p>
    `;

    const html = renderEmailShell({
      preheader: `Welcome to Care101 - Your Patient ID Details`,
      heading: 'Welcome to Care101',
      subheading: 'Your patient account is ready.',
      bodyHtml
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Care101" <no-reply@care101.com>',
      to: patient.email,
      subject: "Welcome to Care101 - Your Patient ID Details",
      text: textBody,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Patient welcome email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending welcome email:", err);
  }
};

/**
 * Sends a password reset OTP code.
 * @param {object} user - Patient or Doctor document
 * @param {string} otp - The 6-digit OTP code
 */
export const sendPasswordResetOtp = async (user, otp) => {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER;
  const hasSmsConfig = apiKey && from && apiKey !== 'your_httpsms_api_key_here' && from !== 'your_httpsms_from_number_here';

  const textBody = `Your password reset code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  // Patients have mobileNumber, Doctors have phone
  const phone = user.mobileNumber || user.phone;

  if (hasSmsConfig && phone) {
    try {
      await sendSms(phone, textBody);
    } catch (smsErr) {
      console.error("❌ SMS password reset OTP failed:", smsErr);
    }
  }

  if (!user.email) {
    console.log("⚠️ No email address provided, skipping OTP reset email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear User,</p>
      <p style="margin:0 0 16px 0;">You requested a password reset. Please use the verification code below to reset your password:</p>
      
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef08a; border:1px solid #fef08a; border-radius:8px; padding:14px 16px; margin-bottom:16px;">
        <tr>
          <td style="font-size:18px; font-weight:700; text-align:center; color:#854d0e; letter-spacing:2px;">
            ${otp}
          </td>
        </tr>
      </table>
      
      <p style="margin:0 0 16px 0;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    `;

    const html = renderEmailShell({
      preheader: `Your Password Reset Code`,
      heading: 'Password Reset Request',
      subheading: 'Verification code details.',
      bodyHtml
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Care101" <no-reply@care101.com>',
      to: user.email,
      subject: "Your Password Reset Code",
      text: textBody,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset OTP email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending password reset OTP email:", err);
  }
};

/**
 * Sends a password reset link to an administrator.
 * @param {object} admin - Admin document
 * @param {string} resetUrl - Reset link URL
 */
export const sendAdminPasswordReset = async (admin, resetUrl) => {
  const textBody = `You requested a password reset. Please go to this link to reset your password: \n\n ${resetUrl} \n\n This link expires in 15 minutes.`;

  if (!admin.email) {
    console.log("⚠️ No email address provided, skipping admin reset link email.");
    return;
  }

  try {
    const transporter = await getTransporter();

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear Administrator,</p>
      <p style="margin:0 0 16px 0;">You requested a password reset. Please click the button below to reset your password:</p>
      
      <p style="margin:20px 0; text-align:center;">
        <a href="${resetUrl}" style="background-color:${BRAND.primary}; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Reset Password</a>
      </p>
      
      <p style="margin:0 0 16px 0;">This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
    `;

    const html = renderEmailShell({
      preheader: `Admin Password Reset Request`,
      heading: 'Admin Password Reset Request',
      subheading: 'Reset your administrator password.',
      bodyHtml
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || '"Care101 IT" <no-reply@care101.com>',
      to: admin.email,
      subject: "Admin Password Reset Request",
      text: textBody,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Admin password reset email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending admin password reset email:", err);
  }
};
