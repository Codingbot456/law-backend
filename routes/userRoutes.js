const express = require('express');
const router = express.Router();
const AuthController = require('../middleware/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/user', authMiddleware, AuthController.getProfile);
router.put('/user', authMiddleware, AuthController.updateProfile);
router.get('/users', authMiddleware, AuthController.getAllUsers); // New route to get all users

module.exports = router;
