const admin = require('../config/firebase');
const { client: twilioClient, from: twilioFrom } = require('../config/twilio');
const supabase = require('../config/supabase');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendPush(userId, { title, body, data = {} }) {
  if (!admin.apps.length) return;

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens?.length) return;

  const messages = tokens.map((t) => ({
    token: t.token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  }));

  try {
    await admin.messaging().sendEach(messages);
  } catch (err) {
    console.error('FCM error:', err.message);
  }
}

async function sendSMS(phone, message) {
  if (!phone) return;
  try {
    await twilioClient.messages.create({ body: message, from: twilioFrom, to: phone });
  } catch (err) {
    console.error('Twilio error:', err.message);
  }
}

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({ from: `"Loklii" <${process.env.SMTP_USER}>`, to, subject, html });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

async function notify(userId, type, { title, body, data = {}, smsBody = null, emailTo = null, emailSubject = null, emailHtml = null }) {
  // Save to DB
  await supabase.from('notifications').insert({
    user_id: userId, type, title, body, data,
    sent_push: true, sent_sms: !!smsBody,
  });

  // Push
  await sendPush(userId, { title, body, data });

  // SMS if provided
  if (smsBody) {
    const { data: user } = await supabase.from('users').select('phone').eq('id', userId).single();
    if (user?.phone) await sendSMS(user.phone, smsBody);
  }

  // Email if provided
  if (emailTo && emailSubject && emailHtml) {
    await sendEmail(emailTo, emailSubject, emailHtml);
  }
}

async function notifyAdmin(subject, message) {
  await sendEmail(process.env.ADMIN_NOTIFICATION_EMAIL, `[Loklii Admin] ${subject}`, `<p>${message}</p>`);
  await sendSMS(process.env.ADMIN_NOTIFICATION_PHONE, `[Loklii] ${subject}: ${message}`);
}

module.exports = { notify, notifyAdmin, sendPush, sendSMS, sendEmail };
