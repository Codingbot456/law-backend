// middleware/paymentCheck.js

const db = require('../config/db');

const checkPaymentStatus = async (req, res, next) => {
  const { paymentToken } = req.params;

  try {
    const [rows] = await db.query('SELECT paymentStatus FROM answers WHERE paymentToken = ?', [paymentToken]);
    if (rows.length > 0 && rows[0].paymentStatus === 'completed') {
      return next(); // Payment completed, proceed to next middleware or route
    } else {
      res.status(403).json({ error: 'Payment required to view this content' });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Error checking payment status' });
  }
};

module.exports = checkPaymentStatus;
