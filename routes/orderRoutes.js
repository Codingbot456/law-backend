const express = require('express');
const { createOrder, getOrders, getCounties, updateOrderStatus, getUserOrders } = require('../controllers/orderController');

const router = express.Router();

// Endpoint to create a new order
router.post('/', createOrder);

// Endpoint to get all orders
router.get('/', getOrders);

// Endpoint to update the status of an existing order
router.put('/status', updateOrderStatus);

// Endpoint to get all counties
router.get('/counties', getCounties);

// Endpoint to get orders for a specific user
router.get('/user-orders', getUserOrders);

module.exports = router;
