const Chat = require('../models/Chat');
const BalanceTransaction = require('../models/BalanceTransaction');
const { getIO } = require('../sockets/io');

async function assertMembership(chatId, userId) {
  const chat = await Chat.findById(chatId);
  if (!chat) return { error: { status: 404, message: 'Chat not found' } };
  if (!chat.participants.map(String).includes(String(userId))) return { error: { status: 403, message: 'Forbidden' } };
  return { chat };
}

exports.createManualAdjustment = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  const { amountUsd = 0, amountCny = 0, operation = 'add', note } = req.body || {};

  const usd = Number(amountUsd) || 0;
  const cny = Number(amountCny) || 0;
  if (usd <= 0 && cny <= 0) {
    return res.status(400).json({ message: 'Provide amountUsd and/or amountCny > 0' });
  }

  const check = await assertMembership(chatId, userId);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });

  // Only the chat creator can manually adjust balances
  if (String(check.chat.creator) !== String(userId)) {
    return res.status(403).json({ message: 'Only the chat creator can adjust balance' });
  }

  const op = String(operation).toLowerCase() === 'subtract' ? 'subtract' : 'add';
  const deltaUsd = op === 'subtract' ? -usd : usd;
  const deltaCny = op === 'subtract' ? -cny : cny;

  check.chat.balanceUsd += deltaUsd;
  check.chat.balanceCny += deltaCny;
  await check.chat.save();

  const tx = await BalanceTransaction.create({
    chat: chatId,
    type: 'manual',
    deltaUsd,
    deltaCny,
    note,
    createdBy: userId,
  });

  const room = chatId.toString();
  getIO().to(room).emit('chat:balanceUpdated', check.chat);

  return res.status(201).json({ chat: check.chat, transaction: tx });
};

exports.listTransactions = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  const check = await assertMembership(chatId, userId);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });

  const txs = await BalanceTransaction.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username')
    .lean();

  return res.json(txs);
};
