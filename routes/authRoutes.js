const express = require('express');
const router = express.Router();
const authController = require('../middleware/authController');
const passwordController = require('../controllers/passwordController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', passwordController.forgotPassword);
router.post('/reset-password/:token', passwordController.resetPassword);

module.exports = router;
