const express = require('express');
const router = express.Router();
const moment = require('moment');
const { getAccessToken, processStkPush, registerC2BUrl } = require('../services/mpesaService2');

// Root route
router.get("/", (req, res) => {
  const timeStamp = moment().format("YYYYMMDDHHmmss");
  console.log("Root Route Hit. Current Timestamp:", timeStamp);
  res.send("MPESA DARAJA API WITH NODE JS BY UMESKIA SOFTWARES");
});

// Access token route
router.get("/access_token", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      console.log("Access Token retrieved successfully:", accessToken);
      res.send("😀 Your access token is " + accessToken);
    })
    .catch((error) => {
      console.error('Error fetching access token:', error.message);
      res.status(500).send("Error fetching access token");
    });
});

// STK push route
router.post("/stkpush2", (req, res) => {
  const { phoneNumber, amount, orderId } = req.body;

  console.log("Received STK push request:");
  console.log("Phone Number:", phoneNumber);
  console.log("Amount:", amount);
  console.log("Order ID:", orderId);

  getAccessToken()
    .then((accessToken) => {
      console.log("Access Token retrieved for STK push");
      processStkPush(accessToken, phoneNumber, amount, orderId, req, res);
    })
    .catch((error) => {
      console.error('Error processing STK push:', error.message);
      res.status(500).send("❌ Request failed");
    });
});

// STK push callback route
router.post("/callback", (req, res) => {
  console.log("STK PUSH CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

  const { Body: { stkCallback } } = req.body;
  const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

  const paymentStatus = ResultCode === 0 ? 'paid' : 'failed';
  const paymentDate = new Date();

  console.log(`Callback Data:`);
  console.log(`CheckoutRequestID (Payment Reference): ${CheckoutRequestID}`);
  console.log(`ResultCode: ${ResultCode}`);
  console.log(`ResultDesc: ${ResultDesc}`);
  console.log(`PaymentStatus: ${paymentStatus}`);

  const updateOrderStatus = `
    UPDATE orders
    SET payment_status = ?, payment_date = ?, payment_reference = ?
    WHERE payment_reference = ?
  `;

  const parameters = [paymentStatus, paymentDate, CheckoutRequestID, CheckoutRequestID];

  console.log("Executing SQL Query:", updateOrderStatus);
  console.log("Parameters:", parameters);

  db.query(updateOrderStatus, parameters, (err, result) => {
    if (err) {
      console.error('Error updating order status:', err.message);
      return res.status(500).send('Internal Server Error');
    }

    console.log("Order status updated in database:", result);

    if (result.affectedRows === 0) {
      console.warn('No rows updated. Check if payment_reference matches existing records.');
    } else {
      console.log(`Number of rows updated: ${result.affectedRows}`);
    }

    res.status(200).send('Order status updated successfully');
  });
});

// Register URL for C2B route
router.get("/registerurl", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      console.log("Access Token retrieved for C2B URL registration");
      registerC2BUrl(accessToken, res);
    })
    .catch((error) => {
      console.error('Error fetching access token for C2B URL registration:', error.message);
      res.status(500).send('Error fetching access token');
    });
});

module.exports = router;
