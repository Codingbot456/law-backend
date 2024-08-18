const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, '../logs/orders.log'), { flags: 'a' });

const logger = (req, res, next) => {
  const logMessage = `${new Date().toISOString()} - ${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}\n`;
  logStream.write(logMessage);
  next();
};

module.exports = logger;
