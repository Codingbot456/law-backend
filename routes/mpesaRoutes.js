// routes/paymentRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const moment = require('moment');
const axios = require('axios');
const { getAccessToken, processStkPush, registerC2BUrl } = require('../services/mpesaService');
const db = require('../config/db');
const checkPaymentStatus = require('../middleware/paymentCheck');

// Render payment page
router.get('/payment/:paymentToken', async (req, res) => {
  const { paymentToken } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM answers WHERE paymentToken = ?', [paymentToken]);
    if (rows.length > 0) {
      const { budget } = rows[0];

      res.send(`
        <html>
        <body>
          <h1>Pay ${budget}</h1>
          <form action="/payment/confirm/${paymentToken}" method="post">
            <button type="submit">Pay Now</button>
          </form>
        </body>
        </html>
      `);
    } else {
      res.status(404).send('Payment request not found');
    }
  } catch (error) {
    console.error('Error during payment page rendering:', error);
    res.status(500).json({ error: 'Error processing payment request' });
  }
});

// Confirm payment
router.post('/payment/confirm/:paymentToken', async (req, res) => {
  const { paymentToken } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM answers WHERE paymentToken = ?', [paymentToken]);
    if (rows.length > 0) {
      const { submissionId } = rows[0];

      await db.query('UPDATE answers SET paymentStatus = ? WHERE paymentToken = ?', ['completed', paymentToken]);

      res.send('Payment completed successfully. You can now view the answer.');
    } else {
      res.status(404).send('Payment request not found');
    }
  } catch (error) {
    console.error('Error during payment confirmation:', error);
    res.status(500).json({ error: 'Error confirming payment' });
  }
});

// Handle STK push callback
router.post('/callback', (req, res) => {
  console.log("STK PUSH CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

  const { Body: { stkCallback } } = req.body;
  const { CheckoutRequestID, ResultCode } = stkCallback;

  console.log("CheckoutRequestID:", CheckoutRequestID);
  console.log("ResultCode:", ResultCode);

  const paymentStatus = ResultCode === 0 ? 'completed' : 'failed';
  const paymentDate = new Date();

  const updatePaymentStatus = `
    UPDATE answers
    SET paymentStatus = ?, paymentDate = ?, mpesaReceiptNumber = ?
    WHERE paymentToken = ?`;

  db.query(updatePaymentStatus, [paymentStatus, paymentDate, CheckoutRequestID, CheckoutRequestID], (err, result) => {
    if (err) {
      console.error('Error updating payment status:', err);
      return res.status(500).send('Internal Server Error');
    }

    console.log("Payment status updated in database");

    fs.writeFile("stkcallback.json", JSON.stringify(req.body, null, 2), "utf8", (err) => {
      if (err) {
        console.error('Error saving callback data:', err);
        return res.status(500).send('Internal Server Error');
      }

      console.log("STK PUSH CALLBACK JSON FILE SAVED");
      res.status(200).send('Payment status updated successfully');
    });
  });
});

// Register C2B URL
router.get('/registerurl', (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      registerC2BUrl(accessToken, res);
    })
    .catch(console.log);
});

module.exports = router;
