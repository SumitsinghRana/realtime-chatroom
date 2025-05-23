const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roomId: { type: Number, required: true, unique: true },
  password: { type: String, required: true },
  createdBy: { type: String, required: true }, // username
  isPrivate: { type: Boolean, default: true }
});

module.exports = mongoose.model('Room', roomSchema);
