const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'payment'], required: true },
    content: { type: String }, // text
    // image data (lazy-loaded via dedicated route)
    imageBase64: { type: String },
    imageMimeType: { type: String },
    // payment receipt data (lazy-loaded via dedicated route)
    receiptBase64: { type: String },
    receiptMimeType: { type: String },
    amountUsd: { type: Number, default: 0 },
    amountCny: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
