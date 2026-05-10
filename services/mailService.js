const transporter = require('../config/mailer');

exports.enviarCorreo = ({ to, subject, html, text }) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return Promise.resolve(null);
  return transporter.sendMail({
    from: `"Biblioteca Digital" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text
  });
};
