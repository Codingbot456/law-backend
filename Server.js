const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // Import path module

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', // Replace with your frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
    credentials: true,
  },
});

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:3000', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Enable sending cookies with requests
  optionsSuccessStatus: 200, // For legacy browser support
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes setup
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const submissionsRoutes = require('./routes/submissions'); // Add submissions routes
const blogRoutes = require('./routes/blogRoutes'); // Import blog routes
const mpesaRoutes = require('./routes/mpesaRoutes');
const mpesaRoutes2 = require('./routes/mpesaRoutes2');

const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Mounting routes
app.use('/api', authRoutes);
app.use('/api', passwordRoutes);
app.use('/api', userRoutes);
app.use('/api', adminRoutes);
app.use('/api', mpesaRoutes);
app.use('/api', mpesaRoutes2);
app.use('/api', productRoutes);
app.use('/api/submissions', submissionsRoutes); // Mount submissions routes
app.use('/api/blog', blogRoutes); // Mount blog routes
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Something broke!');
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected');

  // You can handle events here

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
