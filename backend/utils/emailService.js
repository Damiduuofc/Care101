import nodemailer from 'nodemailer';
import Client from 'android-sms-gateway';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

// Helper to format phone number to E.164
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    return '+94' + cleaned.slice(1);
  }
  if (cleaned.startsWith('94')) {
    return '+' + cleaned;
  }
  // Sri Lankan 9-digit mobile number without leading zero (e.g., 771234567)
  if (cleaned.length === 9 && cleaned.startsWith('7')) {
    return '+94' + cleaned;
  }
  return '+' + cleaned;
};

// Check if SMS gateway is configured
export const isSmsConfigured = () => {
  const password = process.env.SMS_GATEWAY_PASSWORD;
  return Boolean(password && password !== 'your_password_here');
};

let lastSmsError = null;

export const getLastSmsError = () => lastSmsError;

// Helper to send SMS via Android SMS Gateway
export const sendSms = async (to, content) => {
  const login = process.env.SMS_GATEWAY_LOGIN || '';
  const password = process.env.SMS_GATEWAY_PASSWORD;
  let baseUrl = process.env.SMS_GATEWAY_BASE_URL;

  if (!isSmsConfigured()) {
    lastSmsError = "Android SMS Gateway configuration missing (SMS_GATEWAY_PASSWORD missing or placeholder).";
    console.log("⚠️ Android SMS Gateway configuration missing or placeholder detected, skipping SMS send.");
    return false;
  }

  if (baseUrl) {
    baseUrl = baseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'http://' + baseUrl;
    }
  }

  const formattedTo = formatPhoneNumber(to);
  if (!formattedTo) {
    lastSmsError = `Recipient phone number "${to}" is invalid.`;
    console.log("⚠️ Recipient phone number is invalid, skipping SMS send.");
    return false;
  }

  const simNumberRaw = process.env.SMS_GATEWAY_SIM_NUMBER;
  const simNumber = simNumberRaw !== undefined && simNumberRaw !== '' ? parseInt(simNumberRaw, 10) : undefined;

  const httpClient = {
    post: async (url, body, headers) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
      });
      if (response.status === 204) return null;
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text}`);
      }
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    },
    get: async (url, headers) => {
      const response = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(10000) });
      if (response.status === 204) return null;
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text}`);
      }
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    },
    delete: async (url, headers) => {
      const response = await fetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(10000) });
      return response.ok;
    }
  };

  try {
    lastSmsError = null;
    const client = new Client(login, password, httpClient, baseUrl || undefined);
    console.log(`✉️ Sending SMS to ${formattedTo} via ${baseUrl || 'default gateway'} (SIM: ${simNumber ?? 'auto'})...`);
    const messageState = await client.send({
      message: content,
      phoneNumbers: [formattedTo],
      ...(simNumber !== undefined && !isNaN(simNumber) ? { simNumber } : {})
    });
    console.log(`✅ SMS sent successfully to ${formattedTo}: Message ID ${messageState?.id || 'OK'}`);
    return true;
  } catch (err) {
    const causeCode = err?.cause?.code || '';
    const causeMsg = err?.cause?.message || '';
    const detail = causeCode || causeMsg ? `${err.message} (${causeCode || causeMsg})` : (err.message || String(err));
    lastSmsError = `Failed to connect to SMS Gateway at ${baseUrl || 'gateway'}: ${detail}`;
    console.error(`❌ Error sending SMS via Android SMS Gateway to ${formattedTo}:`, detail);
    return false;
  }
};

// Helper to get formatted From header
export const getFromAddress = (senderName = "Suwasevana Hospital") => {
  const emailUser = process.env.EMAIL_USER;
  if (emailUser) {
    return `"${senderName}" <${emailUser}>`;
  }
  return `"${senderName}" <no-reply@suwasevana.com>`;
};

// Helper to get transporter with dynamic cache invalidation
let cachedTransporter = null;
let cachedConfigKey = null;

export const getTransporter = async () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const cleanPass = pass ? pass.trim().replace(/\s+/g, '') : '';

  const currentConfigKey = `${host}:${port}:${user}:${cleanPass}`;

  if (cachedTransporter && cachedConfigKey === currentConfigKey && cleanPass) {
    return cachedTransporter;
  }

  if (user && cleanPass) {
    const isGmail = host.includes('gmail') || user.endsWith('@gmail.com');
    const transportConfig = isGmail
      ? {
          service: 'gmail',
          auth: { user, pass: cleanPass },
          tls: { rejectUnauthorized: false }
        }
      : {
          host,
          port,
          secure: port === 465,
          auth: { user, pass: cleanPass },
          tls: { rejectUnauthorized: false }
        };

    cachedTransporter = nodemailer.createTransport(transportConfig);
    cachedConfigKey = currentConfigKey;
    console.log(`📧 Configured email transporter for ${user} (${isGmail ? 'Gmail Service' : `${host}:${port}`})`);
    return cachedTransporter;
  }

  // Fallback: If no SMTP credentials provided in env, use Ethereal or console logger
  console.log("⚠️ No SMTP credentials configured. Generating test account...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    cachedConfigKey = 'ethereal';
    return cachedTransporter;
  } catch (err) {
    console.error("❌ Failed to create Ethereal account, falling back to console logger transporter", err);
    cachedTransporter = {
      sendMail: async (mailOptions) => {
        console.log("✉️ MOCK EMAIL SENT:");
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text}`);
        return { messageId: 'mock-message-id', mock: true };
      }
    };
    cachedConfigKey = 'mock';
    return cachedTransporter;
  }
};

// ---------------------------------------------------------------------------
// Shared brand styling for all outgoing emails
// ---------------------------------------------------------------------------
const BRAND = {
  name: 'Suwasevana Hospital',
  location: 'Kandy',
  ink: '#111827',
  text: '#374151',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#e5e7eb',
  surface: '#f9fafb',
  link: '#1d4ed8',
  supportEmail: 'support@suwasewana.com',
  supportPhone: '+94 81 222 3223'
};

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const MONO = `'SF Mono', Menlo, Consolas, 'Courier New', monospace`;

const VISITOR_NOTE = 'Please limit visitors for your safety. Patients may bring one companion to consultations.';

/**
 * Wraps inner HTML in a minimal, responsive email shell:
 * wordmark, white content card, and a quiet footer outside the card.
 */
const renderEmailShell = ({ preheader = '', heading, subheading, bodyHtml, footerNote = '' }) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<title>${BRAND.name}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:${FONT}; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">

          <tr>
            <td style="padding:0 4px 20px 4px; font-size:14px; color:${BRAND.ink}; font-weight:600; letter-spacing:-0.1px;">
              ${BRAND.name}<span style="color:${BRAND.subtle}; font-weight:400;">&nbsp;&nbsp;/&nbsp;&nbsp;${BRAND.location}</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff; border:1px solid ${BRAND.border}; border-radius:8px; padding:40px 40px 36px 40px;">
              <h1 style="margin:0; font-size:22px; line-height:1.3; color:${BRAND.ink}; font-weight:600; letter-spacing:-0.3px;">${heading}</h1>
              ${subheading ? `<p style="margin:8px 0 0 0; font-size:15px; line-height:1.5; color:${BRAND.muted};">${subheading}</p>` : ''}
              <div style="height:28px; line-height:28px;">&nbsp;</div>
              <div style="font-size:15px; line-height:1.6; color:${BRAND.text};">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 4px 0 4px; font-size:12px; line-height:1.6; color:${BRAND.subtle};">
              ${footerNote ? `<p style="margin:0 0 12px 0;">${footerNote}</p>` : ''}
              <p style="margin:0 0 12px 0;">
                Questions? <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.muted}; text-decoration:underline;">${BRAND.supportEmail}</a> &middot; ${BRAND.supportPhone}
              </p>
              <p style="margin:0;">&copy; ${new Date().getFullYear()} ${BRAND.name}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/** Body paragraph */
const para = (html, { last = false } = {}) =>
  `<p style="margin:0 0 ${last ? 0 : 16}px 0;">${html}</p>`;

/** Small uppercase section label */
const sectionLabel = (text) =>
  `<p style="margin:28px 0 4px 0; font-size:12px; font-weight:600; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND.muted};">${text}</p>`;

/** Label / value row separated by hairlines */
const infoRow = (label, value) => `
  <tr>
    <td style="padding:12px 0; border-top:1px solid ${BRAND.border}; font-size:14px; color:${BRAND.muted}; vertical-align:top; width:40%;">${label}</td>
    <td style="padding:12px 0; border-top:1px solid ${BRAND.border}; font-size:14px; color:${BRAND.ink}; text-align:right; vertical-align:top;">${value}</td>
  </tr>
`;

/** Emphasised closing row, e.g. totals */
const totalRow = (label, value) => `
  <tr data-total>
    <td style="padding:14px 0 0 0; border-top:1px solid ${BRAND.ink}; font-size:14px; color:${BRAND.ink}; font-weight:600;">${label}</td>
    <td style="padding:14px 0 0 0; border-top:1px solid ${BRAND.ink}; font-size:16px; color:${BRAND.ink}; font-weight:600; text-align:right;">${value}</td>
  </tr>
`;

/** Table wrapper for infoRow / totalRow */
const detailList = (rowsHtml) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;${rowsHtml.includes('data-total') ? '' : ` border-bottom:1px solid ${BRAND.border};`}">
    ${rowsHtml}
  </table>
`;

/** Small status pill. tone: 'success' | 'pending' */
const statusBadge = (text, tone = 'success') => {
  const t = tone === 'pending'
    ? { fg: '#92400e', bg: '#fef3c7' }
    : { fg: '#065f46', bg: '#d1fae5' };
  return `<p style="margin:0 0 20px 0;"><span style="display:inline-block; padding:4px 10px; border-radius:999px; background-color:${t.bg}; color:${t.fg}; font-size:12px; font-weight:600; letter-spacing:0.2px;">${text}</span></p>`;
};

/** Quiet note with a thin left rule */
const note = (html) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;">
    <tr>
      <td style="border-left:2px solid ${BRAND.border}; padding:2px 0 2px 14px; font-size:13px; line-height:1.6; color:${BRAND.muted};">${html}</td>
    </tr>
  </table>
`;

/** Large monospace code, for OTPs and credentials */
const codeBlock = (value) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
    <tr>
      <td align="center" style="background-color:${BRAND.surface}; border:1px solid ${BRAND.border}; border-radius:6px; padding:20px; font-family:${MONO}; font-size:28px; font-weight:600; letter-spacing:8px; color:${BRAND.ink};">${value}</td>
    </tr>
  </table>
`;

/** Inline monospace value */
const mono = (value) =>
  `<span style="font-family:${MONO}; font-size:13px;">${value}</span>`;

/** Primary call-to-action button */
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
    <tr>
      <td style="background-color:${BRAND.ink}; border-radius:6px;">
        <a href="${href}" style="display:inline-block; padding:12px 22px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>
`;

/** Sign-off block */
const signoff = (team) =>
  `<p style="margin:28px 0 0 0; color:${BRAND.text};">Regards,<br/><span style="color:${BRAND.ink};">${team}</span></p>`;

/**
 * Sends a booking confirmation email to the patient.
 * @param {string} email - Patient's email address
 * @param {object} appointment - The created appointment details
 * @param {string} doctorRoom - Doctor's allocated room number
 * @param {Buffer} pdfBuffer - Optional PDF receipt attachment
 */
export const sendBookingConfirmation = async (email, appointment, doctorRoom = "TBA", pdfBuffer = null) => {
  const hasSmsConfig = isSmsConfigured();

  const isPaid = (appointment?.paymentStatus || '').toLowerCase() === 'paid';
  const amountFormatted = appointment?.amount ? Number(appointment.amount).toLocaleString() : '3,500';

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

      if (!phone && email) {
        const patientObj = await Patient.findOne({ email });
        if (patientObj) {
          phone = patientObj.mobileNumber;
        }
      }

      if (phone) {
        const appDate = new Date(appointment.date);
        const dateStr = appDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = appDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const refNo = appointment.queueNumber ? `${appointment.queueNumber} (ID: ${appointment._id})` : appointment._id;
        const deadline = `${timeStr}, ${dateStr}`;

        const textBody = isPaid
          ? `Reservation Ref No.: ${refNo}
Status: PAID & CONFIRMED

Payment of LKR ${amountFormatted} received successfully.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${dateStr}
Time: ${timeStr}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`
          : `Reservation Ref No.: ${refNo}
Deadline: ${deadline}

Due Payment (LKR ${amountFormatted})

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

    const textBody = isPaid
      ? `Reservation Ref No.: ${refNo}
Status: PAID & CONFIRMED

Payment of LKR ${amountFormatted} received successfully.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${formattedDate}
Time: ${formattedTime}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`
      : `Reservation Ref No.: ${refNo}
Deadline: ${deadline}

Due Payment (LKR ${amountFormatted})

This Reservation will be confirmed ONLY upon full payment prior to the deadline.

Dr. ${appointment.doctorName}
No: ${doctorRoom || "TBA"}
Hospital: Suwasevana Hospital - Kandy
Date: ${formattedDate}
Time: ${formattedTime}

Kindly limit visitors to the hospital for your own safety. Patients are advised to bring only one person accompanying them for consultations.`;

    const appointmentRows =
      infoRow('Reference', mono(refNo)) +
      infoRow('Doctor', `Dr. ${appointment.doctorName}`) +
      infoRow('Room', doctorRoom || 'TBA') +
      infoRow('Date', formattedDate) +
      infoRow('Time', formattedTime);

    const bodyHtml = isPaid
      ? `
        ${statusBadge('Paid', 'success')}
        ${para('Your appointment is booked and payment has been received.', { last: true })}
        ${sectionLabel('Appointment')}
        ${detailList(appointmentRows + infoRow('Location', `${BRAND.name}, ${BRAND.location}`))}
        ${sectionLabel('Payment')}
        ${detailList(infoRow('Status', 'Paid') + infoRow('Amount', `LKR ${amountFormatted}`))}
      `
      : `
        ${statusBadge('Payment pending', 'pending')}
        ${para(`Your reservation is held until <span style="color:${BRAND.ink}; font-weight:600;">${deadline}</span>. It will be confirmed once full payment is received before then.`, { last: true })}
        ${sectionLabel('Appointment')}
        ${detailList(appointmentRows + infoRow('Location', `${BRAND.name}, ${BRAND.location}`))}
        ${sectionLabel('Payment')}
        ${detailList(infoRow('Pay before', deadline) + infoRow('Amount due', `LKR ${amountFormatted}`))}
      `;

    const html = renderEmailShell({
      preheader: isPaid
        ? `Dr. ${appointment.doctorName} on ${formattedDate} at ${formattedTime}. Payment received.`
        : `Pay LKR ${amountFormatted} before ${deadline} to confirm your appointment.`,
      heading: isPaid ? 'Your appointment is confirmed' : 'Reservation received',
      bodyHtml,
      footerNote: VISITOR_NOTE
    });

    const mailOptions = {
      from: getFromAddress("Suwasevana Hospital"),
      to: email,
      subject: isPaid
        ? `Appointment confirmed – Ref ${appointment.queueNumber || appointment._id}`
        : `Reservation received – payment due (Ref ${appointment.queueNumber || appointment._id})`,
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
  const hasSmsConfig = isSmsConfigured();

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

      if (!phone && email) {
        const patientObj = await Patient.findOne({ email });
        if (patientObj) {
          phone = patientObj.mobileNumber;
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
      ${para(`Thank you for your payment for ${bill.title}. A PDF copy of your receipt is attached.`, { last: true })}
      ${sectionLabel('Receipt')}
      ${detailList(
        infoRow('Reference', mono(bill._id)) +
        infoRow('Description', bill.title) +
        infoRow('Date', dateStr) +
        infoRow('Status', 'Paid') +
        totalRow('Total paid', `LKR ${bill.amount.toLocaleString()}`)
      )}
    `;

    const html = renderEmailShell({
      preheader: `LKR ${bill.amount.toLocaleString()} received for ${bill.title}. Receipt attached.`,
      heading: 'Payment received',
      bodyHtml,
      footerNote: VISITOR_NOTE
    });

    const mailOptions = {
      from: getFromAddress("Suwasevana Hospital"),
      to: email,
      subject: `Payment receipt – Ref ${bill._id}`,
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
  const hasSmsConfig = isSmsConfigured();

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
      ${para(`Dear Dr. ${doctorName},`)}
      ${para('Your account on Care101, the hospital’s healthcare management system, has been created. Sign in to the Care101 app (App Store or Google Play) with the details below.', { last: true })}
      ${sectionLabel('Sign-in details')}
      ${detailList(
        infoRow('SLMC number', mono(slmcReg || 'N/A')) +
        infoRow('Email', email) +
        infoRow('Temporary password', mono(password))
      )}
      ${note('This password is temporary. Please change it after your first sign-in. If you have trouble accessing your account, contact the system administrator.')}
      ${signoff('Administration, Suwasevana Hospital')}
    `;

    const html = renderEmailShell({
      preheader: 'Your Care101 doctor account is ready. Sign-in details inside.',
      heading: 'Your account is ready',
      bodyHtml
    });

    const mailOptions = {
      from: getFromAddress("Suwasevana Hospital"),
      to: email,
      subject: 'Your Care101 doctor account is ready',
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
  const hasSmsConfig = isSmsConfigured();

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
      ${statusBadge('Active', 'success')}
      ${para(`Dear Dr. ${doctorName},`)}
      ${para('Your Care101 account has been approved by the administrator. You can now sign in to the Care101 app or dashboard with your registered credentials.', { last: true })}
      ${note('If you have trouble accessing your account, contact the system administrator.')}
      ${signoff('Administration, Suwasevana Hospital')}
    `;

    const html = renderEmailShell({
      preheader: 'Your Care101 doctor account has been approved. You can sign in now.',
      heading: 'Your account has been approved',
      bodyHtml
    });

    const mailOptions = {
      from: getFromAddress("Suwasevana Hospital"),
      to: email,
      subject: 'Your Care101 account has been approved',
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
  const hasSmsConfig = isSmsConfigured();

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
      ${para(`Hello ${patient.fullName},`)}
      ${para('Your Care101 patient account has been created. Use your Patient ID and password to sign in to the Care101 app.', { last: true })}
      ${sectionLabel('Your Patient ID')}
      ${codeBlock(patient.patientId)}
      ${detailList(
        infoRow('Name', patient.fullName) +
        infoRow('Email', patient.email || 'N/A')
      )}
      ${note('Keep your Patient ID safe. You will need it every time you sign in.')}
    `;

    const html = renderEmailShell({
      preheader: `Your Patient ID is ${patient.patientId}.`,
      heading: 'Welcome to Care101',
      bodyHtml
    });

    const mailOptions = {
      from: getFromAddress("Care101"),
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
  const hasSmsConfig = isSmsConfigured();

  // Short, with the word "code" right before the digits so iOS/Android offer it as autofill
  const textBody = `Your Care101 verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`;

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
      ${para('Use this code to reset your Care101 password. It expires in 10 minutes.')}
      ${codeBlock(otp)}
      ${para('If you didn’t request a password reset, you can ignore this email. Your password will not change.', { last: true })}
      ${note('Care101 staff will never ask you for this code.')}
    `;

    const html = renderEmailShell({
      preheader: `Your verification code is ${otp}. It expires in 10 minutes.`,
      heading: 'Reset your password',
      bodyHtml
    });

    const mailOptions = {
      from: getFromAddress("Care101"),
      to: user.email,
      subject: `${otp} is your Care101 verification code`,
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
      ${para('We received a request to reset the password for your Care101 administrator account. This link expires in 15 minutes.')}
      ${button(resetUrl, 'Reset password')}
      ${para('If you didn’t request this, you can ignore this email.', { last: true })}
      ${note(`Button not working? Paste this link into your browser:<br/><a href="${resetUrl}" style="color:${BRAND.link}; word-break:break-all;">${resetUrl}</a>`)}
    `;

    const html = renderEmailShell({
      preheader: 'Reset your Care101 administrator password. The link expires in 15 minutes.',
      heading: 'Reset your password',
      bodyHtml
    });

    const mailOptions = {
      from: getFromAddress("Care101 Administration"),
      to: admin.email,
      subject: "Reset your Care101 admin password",
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

/**
 * Sends a welcome SMS/email to a newly registered walk-in patient with their Patient ID and password.
 * @param {object} patient - Patient document
 * @param {string} plainPassword - Plain-text password
 */
export const sendWalkinPatientCredentials = async (patient, plainPassword) => {
  const hasSmsConfig = isSmsConfigured();

  const textBody = `Hello ${patient.fullName},\n\nWelcome to Care101! Your patient account has been created successfully.\n\nYour Patient ID (SHP) is: ${patient.patientId}\nYour Password is: ${plainPassword}\n\nPlease use these credentials to log in to the Care101 mobile app.`;

  if (hasSmsConfig && patient.mobileNumber) {
    try {
      await sendSms(patient.mobileNumber, textBody);
      console.log(`✅ Sent walkin credentials SMS to ${patient.mobileNumber}`);
    } catch (smsErr) {
      console.error("❌ SMS patient credentials failed:", smsErr);
    }
  } else {
    console.log(`⚠️ SMS gateway config missing or no phone number. Credentials for ${patient.fullName}: ID: ${patient.patientId}, Pwd: ${plainPassword}`);
  }

  // Also send an email as a fallback if they have provided one
  if (patient.email && !patient.email.startsWith("walkin-")) {
    try {
      const transporter = await getTransporter();

      const bodyHtml = `
        ${para(`Hello ${patient.fullName},`)}
        ${para('Our front desk has created a Care101 patient account for you. Use the details below to sign in to the Care101 app.', { last: true })}
        ${sectionLabel('Sign-in details')}
        ${detailList(
          infoRow('Patient ID', mono(patient.patientId)) +
          infoRow('Password', mono(plainPassword))
        )}
        ${note('For your security, please change your password after you first sign in.')}
      `;

      const html = renderEmailShell({
        preheader: `Your Care101 Patient ID is ${patient.patientId}.`,
        heading: 'Welcome to Care101',
        bodyHtml
      });

      const mailOptions = {
        from: getFromAddress("Care101"),
        to: patient.email,
        subject: "Your Care101 sign-in details",
        text: textBody,
        html
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Patient walkin credentials email sent: ${info.messageId}`);
    } catch (err) {
      console.error("❌ Error sending patient credentials email:", err);
    }
  }
};

/**
 * Diagnostic helper to test email and SMS connectivity on demand.
 */
export const testNotifications = async ({ email, phone }) => {
  const results = {
    email: { attempted: false, success: false },
    sms: { attempted: false, success: false }
  };

  if (email) {
    results.email.attempted = true;
    try {
      const transporter = await getTransporter();
      const mailOptions = {
        from: getFromAddress("Care101 Diagnostic"),
        to: email,
        subject: "Care101 - Notification Service Diagnostic Test",
        text: `This is a test email sent from Care101 at ${new Date().toISOString()}.\n\nIf you are reading this, your email configuration (Gmail SMTP) is working perfectly!`
      };
      const info = await transporter.sendMail(mailOptions);
      results.email.success = true;
      results.email.messageId = info.messageId;
    } catch (err) {
      results.email.error = err.message || String(err);
    }
  }

  if (phone) {
    results.sms.attempted = true;
    try {
      const success = await sendSms(phone, `Care101 Diagnostic: SMS gateway is working! Time: ${new Date().toLocaleTimeString()}`);
      results.sms.success = success;
      if (!success) {
        results.sms.error = getLastSmsError() || "SMS gateway failed to process the request. Check gateway logs.";
      }
    } catch (err) {
      results.sms.error = err.message || String(err);
    }
  }

  return results;
};

