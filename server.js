const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const { initSocket } = require('./sockets/io');
const { requestLogger } = require('./middleware/logger');

dotenv.config();
connectDB();

const app = express();

// Basic CORS & parsers
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
// Request logging (after parsers so we can log body safely)
app.use(requestLogger);

// Health check
app.get('/', (req, res) => {
  res.send('BusinessChat API is running');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Start HTTP + Socket.io
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT;
if (!PORT) {
  console.error('ENV VAR MISSING: PORT must be set in .env');
  process.exit(1);
}
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
