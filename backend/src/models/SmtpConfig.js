const mongoose = require('mongoose');

const smtpConfigSchema = new mongoose.Schema(
  {
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    pass: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    fromName: { type: String, default: 'IAC Mobile System' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SmtpConfig', smtpConfigSchema);
