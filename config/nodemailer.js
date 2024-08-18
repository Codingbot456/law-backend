const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // use environment variable
    pass: process.env.EMAIL_PASS // use environment variable
  }
});

module.exports = transporter;
