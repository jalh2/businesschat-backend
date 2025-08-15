const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatSchema = new Schema(
  {
    name: { type: String, trim: true },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    balanceUsd: { type: Number, default: 0 },
    balanceCny: { type: Number, default: 0 },
    pendingUsd: { type: Number, default: 0 },
    pendingCny: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
