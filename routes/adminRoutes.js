const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const authController = require('../middleware/authController');

// Admin registration route
router.post('/admin/register', authController.registerAdmin);

// Admin login route
router.post('/admin/login', authController.adminLogin);

// Protected admin dashboard route
router.get('/admin/dashboard', adminAuth, (req, res) => {
  res.json({ message: 'Welcome to the admin dashboard' });
});

module.exports = router;
