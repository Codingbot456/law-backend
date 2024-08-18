const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a MySQL connection pool
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test MySQL connection
db.getConnection()
  .then(connection => {
    console.log('MySQL connected!');
    connection.release(); // Release the connection
  })
  .catch(err => {
    console.error('Error connecting to MySQL:', err);
  });

module.exports = db;
