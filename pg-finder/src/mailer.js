const config = require('./config');

let transporter = null;

async function sendMail({ to, subject, text }) {
  if (!config.smtp.host) {
    // No SMTP configured: print so you can test the flow locally.
    console.log(`\n[DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text });
}

// Plug an SMS provider (Twilio, MSG91, ...) in here. Until then the code is printed.
async function sendSms(phone, text) {
  console.log(`\n[DEV SMS]\nTo: +91${phone}\n${text}\n`);
}

module.exports = { sendMail, sendSms };
