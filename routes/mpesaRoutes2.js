const express = require('express');
const router = express.Router();
const fs = require('fs');
const moment = require('moment');
const axios = require('axios');
const { getAccessToken, processStkPush } = require('../services/mpesaService2');
const db = require('../config/db'); // Add your database connection module

// Root route
router.get("/", (req, res) => {
  res.send("MPESA DARAJA API WITH NODE JS BY UMESKIA SOFTWARES");
  const timeStamp = moment().format("YYYYMMDDHHmmss");
  console.log(timeStamp);
});

// Access token route
router.get("/access_token", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      res.send("😀 Your access token is " + accessToken);
    })
    .catch(console.log);
});

// STK push route
router.post("/stkpush", (req, res) => {
  const { phoneNumber, amount, orderId } = req.body;
  getAccessToken()
    .then((accessToken) => {
      processStkPush(accessToken, phoneNumber, amount, orderId, req, res);
    })
    .catch(console.log);
});

// STK push callback route
router.post("/callback", (req, res) => {
  console.log("STK PUSH CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

  const { Body: { stkCallback } } = req.body;
  const { CheckoutRequestID, ResultCode } = stkCallback;

  console.log("CheckoutRequestID:", CheckoutRequestID);
  console.log("ResultCode:", ResultCode);

  const paymentStatus = ResultCode === 0 ? 'paid' : 'failed';
  const paymentDate = new Date();

  const updateOrderStatus = `
  UPDATE orders
  SET payment_status = ?, payment_date = ?, payment_reference = ?, mpesa_receipt_number = ?, transaction_date = ?, phone_number = ?
  WHERE payment_reference = ?`;

  db.query(updateOrderStatus, [paymentStatus, paymentDate, CheckoutRequestID, CheckoutRequestID], (err, result) => {
    if (err) {
      console.error('Error updating order status:', err);
      return res.status(500).send('Internal Server Error');
    }

    console.log("Order status updated in database");

    fs.writeFile("stkcallback.json", JSON.stringify(req.body, null, 2), "utf8", (err) => {
      if (err) {
        console.error('Error saving callback data:', err);
        return res.status(500).send('Internal Server Error');
      }

      console.log("STK PUSH CALLBACK JSON FILE SAVED");
      res.status(200).send('Order status updated successfully');
    });
  });
});

// Register URL for C2B route
router.get("/registerurl", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      registerC2BUrl(accessToken, res);
    })
    .catch(console.log);
});

module.exports = router;