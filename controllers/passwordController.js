const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const transporter = require('../config/nodemailer');

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const resetToken = crypto.randomBytes(20).toString('hex');

  const resetTokenExpiry = new Date();
  resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

  try {
    const [updateResult] = await db.execute('UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?', [resetToken, resetTokenExpiry, email]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).send({ msg: 'User not found' });
    }

    const mailOptions = {
      from: 'mobemobesh28@gmail.com',
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
            <p>Please click on the following link, or paste this into your browser to complete the process:</p>
            <p>https://trend-wear.vercel.app/reset-password/${resetToken}</p>
            <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        res.status(500).send({ msg: 'Email could not be sent' });
      } else {
        console.log('Email sent: ' + info.response);
        res.status(200).send({ msg: 'Password reset instructions sent to your email' });
      }
    });
  } catch (error) {
    console.error('Error updating reset token:', error);
    res.status(500).send({ msg: 'Database error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const currentTime = new Date();
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?', [token, currentTime]);

    if (rows.length === 0) {
      return res.status(400).send({ msg: 'Invalid or expired reset token' });
    }

    const user = rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updateResult] = await db.execute('UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?', [hashedPassword, user.id]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).send({ msg: 'User not found' });
    }

    res.status(200).send({ msg: 'Password reset successful' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).send({ msg: 'Database error' });
  }
};
