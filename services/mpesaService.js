// services/mpesaService.js

const axios = require('axios');
const moment = require('moment');

async function getAccessToken() {
  const consumer_key = process.env.CONSUMER_KEY;
  const consumer_secret = process.env.CONSUMER_SECRET;
  const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const auth = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  try {
    const response = await axios.get(url, { headers: { Authorization: auth } });
    return response.data.access_token;
  } catch (error) {
    throw error;
  }
}

function processStkPush(accessToken, phoneNumber, amount, orderId, res) {
  const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
  const auth = 'Bearer ' + accessToken;
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const password = Buffer.from(`${process.env.BUSINESS_SHORT_CODE}${process.env.LIPA_NA_MPESA_ONLINE_PASSKEY}${timestamp}`).toString('base64');

  axios.post(url, {
    BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: process.env.BUSINESS_SHORT_CODE,
    PhoneNumber: phoneNumber,
    CallBackURL: process.env.CALLBACK_URL,
    AccountReference: orderId,
    TransactionDesc: 'Payment for answered question',
  }, { headers: { Authorization: auth } })
    .then(response => {
      res.send('STK push request successful. Please enter your MPesa PIN to complete the transaction.');
    })
    .catch(error => {
      console.error('STK push error:', error);
      res.status(500).send('STK push request failed.');
    });
}

function registerC2BUrl(accessToken, res) {
  const url = 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl';
  const auth = 'Bearer ' + accessToken;

  axios.post(url, {
    ShortCode: process.env.BUSINESS_SHORT_CODE,
    ResponseType: 'Complete',
    ConfirmationURL: process.env.CALLBACK_URL,
    ValidationURL: process.env.VALIDATION_URL,
  }, { headers: { Authorization: auth } })
    .then(response => {
      res.status(200).json(response.data);
    })
    .catch(error => {
      console.error('Register C2B URL error:', error);
      res.status(500).send('Failed to register C2B URL.');
    });
}

module.exports = {
  getAccessToken,
  processStkPush,
  registerC2BUrl,
};
