const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const multer = require('multer');
const cloudinary = require('../config/cloudinaryConfig');

// Configure multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const secretKey = process.env.JWT_SECRET;
const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Your base URL

// Generate URL for images
const generateImageUrl = (filename) => {
  // Only generate the URL for responses
  if (!filename) return null;
  const imageUrl = filename.startsWith('http') ? filename : `${baseUrl}/uploads/${filename}`;
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
exports.updateProfile = [
  upload.single('profileImage'), // Handle file upload
  async (req, res) => {
    const userId = req.user.id;
    const { name, email, phone, location, password } = req.body;
    const profileImageFile = req.file;

    let profileImageUrl = null;

    if (profileImageFile) {
      try {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({
            folder: 'profile_images',
            resource_type: 'image'
          }, (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }).end(profileImageFile.buffer);
        });
        profileImageUrl = result;
      } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        return res.status(500).send({ msg: 'Image upload failed' });
      }
    }

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
        updatedUser[0].profileImage = generateImageUrl(updatedUser[0].profileImage);
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
exports.register = [
  upload.single('profileImage'), // Handle file upload
  async (req, res) => {
    const { name, email, password, location, phone, role = 'user' } = req.body;
    const profileImageFile = req.file;

    let profileImageUrl = null;

    if (profileImageFile) {
      try {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({
            folder: 'profile_images',
            resource_type: 'image'
          }, (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }).end(profileImageFile.buffer);
        });
        profileImageUrl = result;
      } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        return res.status(500).send({ msg: 'Image upload failed' });
      }
    }

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

// Get all users and their roles including profile images
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch user details including profile image
    const [users] = await db.execute('SELECT id, name, email, phone, location, role, profileImage FROM users');
    
    // If no users are found
    if (users.length === 0) {
      return res.status(404).send({ msg: 'No users found' });
    }

    // Generate full URLs for profile images
    const usersWithImageUrls = users.map(user => {
      if (user.profileImage) {
        user.profileImage = generateImageUrl(user.profileImage);
      }
      return user;
    });

    console.log(`Retrieved all users: ${JSON.stringify(usersWithImageUrls)}`);
    res.send(usersWithImageUrls);
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).send({ msg: 'An error occurred. Please try again.' });
  }
};
