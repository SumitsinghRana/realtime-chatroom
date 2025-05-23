// server/index.js
require('dotenv').config();

const Message = require('./chat/messageModel');
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./auth/authRoutes');
const roomRoutes = require('./rooms/roomRoutes');

const app = express();
const server = http.createServer(app);

const Room = require('./rooms/roomModel'); // import your Room model
const activeRoomUsers = {}; // { roomName: Set(socket.id) }

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*', // Change to frontend domain in production
    methods: ['GET', 'POST']
  }
});

// Socket.io JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user; // Attach user info
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

// Real-time messaging
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

socket.on("join_room", async (room) => {
  socket.join(room);
  socket.currentRoom = room;

  if (!activeRoomUsers[room]) activeRoomUsers[room] = new Set();
  activeRoomUsers[room].add(socket.id);

  console.log(`➡️ User ${socket.id} joined room: ${room}`);

  // Send chat history
  const recentMessages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
  socket.emit("chat_history", recentMessages);

  // Notify others
  socket.to(room).emit("receive_message", {
    sender: "System",
    message: `${socket.user.username} has joined the room.`,
    timestamp: new Date().toISOString()
  });

  socket.on("typing", () => {
  const room = socket.currentRoom;
  if (room && socket.user?.username) {
    // Notify others in the room (excluding sender)
    socket.to(room).emit("show_typing", socket.user.username);
  }
});

socket.on("stop_typing", () => {
  const room = socket.currentRoom;
  if (room) {
    socket.to(room).emit("hide_typing");
  }
});

});

socket.on("send_message", async (data) => {
  const room = data.room || socket.currentRoom;

  if (room) {
    const newMsg = new Message({
      room,
      sender: data.sender,
      message: data.message
    });
    await newMsg.save();

    io.to(room).emit("receive_message", {
      sender: data.sender,
      message: data.message,
      timestamp: newMsg.timestamp
    });
  }
});



  socket.on("disconnect", async () => {
    const room = socket.currentRoom;

    if (room && activeRoomUsers[room]) {
      activeRoomUsers[room].delete(socket.id);

      // If no users left in the room
      if (activeRoomUsers[room].size === 0) {
        delete activeRoomUsers[room];

        // Check if the room is a private room in DB
        const dbRoom = await Room.findOne({ name: room });
        if (dbRoom && dbRoom.isPrivate) {
          await Room.deleteOne({ name: room });
          console.log(`🗑️ Private room "${room}" deleted because it became empty.`);
        }
      }
    }

    console.log(`❌ User disconnected: ${socket.id}`);
  });

});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
