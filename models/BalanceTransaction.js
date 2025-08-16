const mongoose = require('mongoose');
const { Schema } = mongoose;

const balanceTransactionSchema = new Schema(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    // 'manual' for creator adjustments, 'payment' for confirmed participant payments
    type: { type: String, enum: ['manual', 'payment'], required: true },
    deltaUsd: { type: Number, default: 0 },
    deltaCny: { type: Number, default: 0 },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // For payment transactions, link back to the payment message
    message: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BalanceTransaction', balanceTransactionSchema);
