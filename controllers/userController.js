const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Get user profile
exports.getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const [user] = await db.execute('SELECT name, email, phone, location FROM users WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).send({ msg: 'User not found' });
    }
    res.send(user[0]);
  } catch (error) {
    res.status(500).send({ msg: 'An error occurred. Please try again.' });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email, phone, location, password } = req.body;
  try {
    let updateQuery = 'UPDATE users SET name = ?, email = ?, phone = ?, location = ?';
    const params = [name, email, phone, location];

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
    res.send({ msg: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).send({ msg: 'An error occurred. Please try again.' });
  }
};
