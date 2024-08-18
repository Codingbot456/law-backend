const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + path.extname(file.originalname);
    console.log(`Uploading file: ${filename}`);
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });
const secretKey = process.env.JWT_SECRET;
const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Your base URL

// Generate URL for images
const generateImageUrl = (filename) => {
  // Only generate the URL for responses
  if (!filename) return null;
  const imageUrl = `${baseUrl}/uploads/${filename}`;
  console.log(`Generated image URL: ${imageUrl}`);
  return imageUrl;
};

// Get user profile
exports.getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const [user] = await db.execute('SELECT name, email, phone, location, profileImage FROM users WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).send({ msg: 'User not found' });
    }
    // Convert profileImage filename to URL
    if (user[0].profileImage) {
      user[0].profileImage = generateImageUrl(user[0].profileImage);
    }
    console.log(`Retrieved user profile: ${JSON.stringify(user[0])}`);
    res.send(user[0]);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).send({ msg: 'An error occurred. Please try again.' });
  }
};

// Update user profile with Multer for file uploads
// Update user profile with Multer for file uploads
exports.updateProfile = [
  upload.single('profileImage'), // Handle file upload
  async (req, res) => {
    const userId = req.user.id;
    const { name, email, phone, location, password } = req.body;
    const profileImageFilename = req.file ? req.file.filename : null;

    // Base URL for the profile image
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const profileImageUrl = profileImageFilename ? `${baseUrl}/uploads/${profileImageFilename}` : null;

    console.log(`Updating profile for user ID: ${userId}`);
    console.log(`Received profile image filename: ${profileImageFilename}`);
    console.log(`Profile image URL: ${profileImageUrl}`);
    console.log(`Profile update details: Name=${name}, Email=${email}, Phone=${phone}, Location=${location}, Password=${!!password}`);

    try {
      let updateQuery = 'UPDATE users SET name = ?, email = ?, phone = ?, location = ?';
      const params = [name, email, phone, location];

      if (profileImageUrl) {
        updateQuery += ', profileImage = ?';
        params.push(profileImageUrl);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery += ', password = ?';
        params.push(hashedPassword);
      }

      updateQuery += ' WHERE id = ?';
      params.push(userId);

      const [result] = await db.execute(updateQuery, params);
      if (result.affectedRows === 0) {
        return res.status(404).send({ msg: 'User not found' });
      }

      // Retrieve the updated user profile
      const [updatedUser] = await db.execute('SELECT name, email, phone, location, profileImage FROM users WHERE id = ?', [userId]);
      if (updatedUser.length > 0) {
        console.log(`Profile updated successfully. Updated details: ${JSON.stringify(updatedUser[0])}`);
      }

      res.send({ msg: 'Profile updated successfully', user: updatedUser[0] });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).send({ msg: 'An error occurred. Please try again.' });
    }
  }
];


// Register user with Multer for file uploads
// Register user with Multer for file uploads
exports.register = [
  upload.single('profileImage'), // Handle file upload
  async (req, res) => {
    const { name, email, password, location, phone, role = 'user' } = req.body;
    const profileImageFilename = req.file ? req.file.filename : null;

    // Base URL for the profile image
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const profileImageUrl = profileImageFilename ? `${baseUrl}/uploads/${profileImageFilename}` : null;

    console.log(`Registering new user: ${name}`);
    console.log(`Received profile image filename: ${profileImageFilename}`);
    console.log(`Profile image URL: ${profileImageUrl}`);

    try {
      // Check if the email already exists
      const [rows] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);

      if (rows.length > 0) {
        return res.status(400).send({ msg: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute(
        'INSERT INTO users (name, email, password, location, phone, role, profileImage) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, hashedPassword, location, phone, role, profileImageUrl]
      );

      console.log(`User registered successfully: ${email}`);
      res.status(200).send({ msg: 'Registration successful' });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).send({ msg: 'Database error' });
    }
  }
];


// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  console.log(`User login attempt: ${email}`);

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).send({ msg: 'Invalid email or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secretKey, { expiresIn: '1h' });
      console.log(`Login successful for user ID: ${user.id}`);
      res.status(200).send({ token, role: user.role, userId: user.id });
    } else {
      res.status(401).send({ msg: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).send({ msg: 'Database error' });
  }
};

// Register admin
exports.registerAdmin = async (req, res) => {
  const { name, email, password, location, phone } = req.body;

  console.log(`Registering new admin: ${name}`);

  try {
    const [rows] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);

    if (rows.length > 0) {
      return res.status(400).send({ msg: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (name, email, password, location, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, location, phone, 'admin']
    );

    console.log(`Admin registered successfully: ${email}`);
    res.status(200).send({ msg: 'Admin registration successful' });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).send({ msg: 'Database error' });
  }
};

// Admin login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  console.log(`Admin login attempt: ${email}`);

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'admin']);

    if (rows.length === 0) {
      return res.status(401).send({ msg: 'Invalid email or password' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);

    if (isMatch) {
      const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, secretKey, { expiresIn: '1h' });
      console.log(`Admin login successful for admin ID: ${admin.id}`);
      res.status(200).send({ token, userId: admin.id });
    } else {
      res.status(401).send({ msg: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error logging in admin:', error);
    res.status(500).send({ msg: 'Database error' });
  }
};
