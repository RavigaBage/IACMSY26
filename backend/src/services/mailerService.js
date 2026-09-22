const nodemailer = require('nodemailer');
const SmtpConfig = require('../models/SmtpConfig');

async function getTransporter() {
  const config = await SmtpConfig.findOne().sort({ createdAt: -1 });

  const host = config?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(config?.port || process.env.SMTP_PORT || 587);
  const secure = config?.secure !== undefined ? config.secure : false;
  const user = config?.user || process.env.SMTP_USER || '';
  const pass = config?.pass || process.env.SMTP_PASS || '';

  if (!user || !pass) {
    return {
      transporter: null,
      fromEmail: config?.fromEmail || user || 'noreply@iac.system',
      fromName: config?.fromName || 'IAC Mobile System',
      error: 'SMTP credentials (user/password) not configured in settings or environment.',
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return {
    transporter,
    fromEmail: config?.fromEmail || user,
    fromName: config?.fromName || 'IAC Mobile System',
  };
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const { transporter, fromEmail, fromName, error } = await getTransporter();
    if (error || !transporter) {
      console.warn('[Mailer] Skipping email send:', error);
      return { success: false, error: error || 'Transporter unavailable' };
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Email send error:', err.message);
    return { success: false, error: err.message };
  }
}

async function verifyAndSendTestEmail(testRecipient) {
  const { transporter, fromEmail, fromName, error } = await getTransporter();
  if (error || !transporter) {
    throw new Error(error || 'SMTP configuration is incomplete.');
  }

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: testRecipient,
    subject: 'IAC Mobile System - SMTP Configuration Test',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #18181b;">
        <h2 style="color: #0284c7;">SMTP Configuration Success!</h2>
        <p>This is a test email sent from your <strong>IAC Mobile Management Dashboard</strong>.</p>
        <p>Your SMTP server settings are correctly configured and ready to handle automated booking confirmation/rejection notifications.</p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
        <p style="font-size: 12px; color: #71717a;">Sent automatically by IAC Mobile System</p>
      </div>
    `,
  });

  return info;
}

module.exports = {
  sendEmail,
  verifyAndSendTestEmail,
};
