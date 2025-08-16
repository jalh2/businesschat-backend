const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'payment', 'voice'], required: true },
    content: { type: String }, // text
    // image data (lazy-loaded via dedicated route)
    imageBase64: { type: String },
    imageMimeType: { type: String },
    // payment receipt data (lazy-loaded via dedicated route)
    receiptBase64: { type: String },
    receiptMimeType: { type: String },
    // voice message stored in GridFS
    voiceFileId: { type: Schema.Types.ObjectId },
    voiceMimeType: { type: String },
    voiceDuration: { type: Number }, // seconds
    amountUsd: { type: Number, default: 0 },
    amountCny: { type: Number, default: 0 },
    // if true, this is a creator-issued payment alert that should not affect balances
    isCreatorRequest: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
