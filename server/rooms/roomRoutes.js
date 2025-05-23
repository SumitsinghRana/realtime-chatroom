const express = require('express');
const bcrypt = require('bcrypt');
const Room = require('./roomModel');
const router = express.Router();

let currentRoomId = 1000; // Starting ID for private rooms

// Create private room
router.post('/create', async (req, res) => {
  const { name, password, createdBy } = req.body;
  if (!name || !password || password.length !== 4) {
    return res.status(400).json({ message: 'Invalid name or 4-digit password required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const room = new Room({
      name,
      password: hashedPassword,
      roomId: currentRoomId++,
      createdBy
    });
    await room.save();
    res.status(201).json({ roomId: room.roomId, name: room.name });
  } catch (error) {
    res.status(500).json({ message: 'Room creation failed', error });
  }
});

// Join private room
router.post('/join', async (req, res) => {
  const { roomId, password } = req.body;

  try {
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const match = await bcrypt.compare(password, room.password);
    if (!match) return res.status(403).json({ message: 'Incorrect password' });

    res.status(200).json({ name: room.name, roomId: room.roomId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to join room', error });
  }
});

module.exports = router;
