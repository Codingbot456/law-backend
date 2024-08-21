const express = require('express');
const { createOrder, getOrders,getCounties } = require('../controllers/orderController');

const router = express.Router();

router.post('/', createOrder);  // Endpoint to create a new order
router.get('/', getOrders);      // Endpoint to get all orders
router.get('/counties', getCounties);  

module.exports = router;
