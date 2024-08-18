const express = require('express');
const { createOrder, getOrders } = require('../controllers/orderController');

const router = express.Router();

router.post('/', createOrder);  // Endpoint to create a new order
router.get('/', getOrders);      // Endpoint to get all orders

module.exports = router;
