const axios = require('axios');
const moment = require('moment');

async function getAccessToken() {
  const consumer_key = process.env.CONSUMER_KEY;
  const consumer_secret = process.env.CONSUMER_SECRET;
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = "Basic " + Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

  try {
    const response = await axios.get(url, { headers: { Authorization: auth } });
    return response.data.access_token;
  } catch (error) {
    throw error;
  }
}

function processStkPush(accessToken, phoneNumber, amount, transactionId, req, res) {
  const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  const auth = "Bearer " + accessToken;
  const timestamp = moment().format("YYYYMMDDHHmmss");
  
  // Create password
  const password = Buffer.from(
    `${process.env.BUSINESS_SHORT_CODE}${process.env.LIPA_NA_MPESA_ONLINE_PASSKEY}${timestamp}`
  ).toString("base64");

  // Payload for STK Push
  const payload = {
    BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: process.env.BUSINESS_SHORT_CODE,
    PhoneNumber: phoneNumber,
    CallBackURL: process.env.CALLBACK_URL,
    AccountReference: 'trend-wear',  // Use transactionId instead of orderId
    TransactionDesc: "Fashion",
  };

  // Log the payload for debugging
  console.log("STK Push Payload:", payload);

  axios.post(url, payload, { headers: { Authorization: auth } })
    .then((response) => {
      // Log successful response details
      console.log("STK Push Response:", response.data);
      res.send("😀 Request is successfully done ✔✔. Please enter mpesa pin to complete the transaction");
    })
    .catch((error) => {
      // Log error details
      console.error("STK Push Request Failed:");
      console.error("Status Code:", error.response ? error.response.status : 'No response status');
      console.error("Status Text:", error.response ? error.response.statusText : 'No response status text');
      console.error("Error Data:", error.response ? error.response.data : error.message);
      console.error("Error Config:", error.config);
      res.status(500).send("❌ Request failed");
    });
}

function registerC2BUrl(accessToken, res) {
  const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";
  const auth = "Bearer " + accessToken;
  axios.post(url, {
    ShortCode: process.env.BUSINESS_SHORT_CODE,
    ResponseType: "Complete",
    ConfirmationURL: "http://example.com/confirmation",
    ValidationURL: "http://example.com/validation",
  }, { headers: { Authorization: auth } })
  .then((response) => {
    res.status(200).json(response.data);
  })
  .catch((error) => {
    console.log("Register C2B URL request failed");
    console.error("Error:", error.response ? error.response.data : error.message);
    res.status(500).send("❌ Request failed");
  });
}

module.exports = {
  getAccessToken,
  processStkPush,
  registerC2BUrl,
};
