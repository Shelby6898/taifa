const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  try {
    return await resend.emails.send({
      from: 'ICT HelpDesk <noreply@icthelpdesk.site>',
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

module.exports = { sendEmail };
