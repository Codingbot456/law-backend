const express = require('express');
const router = express.Router();
const AuthController = require('../middleware/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/user', authMiddleware, AuthController.getProfile);
router.put('/user', authMiddleware, AuthController.updateProfile);

module.exports = router;
