const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { getIO } = require('../sockets/io');

function toPublicMessage(m) {
  const obj = m.toObject ? m.toObject() : m;
  delete obj.imageBase64;
  delete obj.receiptBase64;
  obj.hasImage = Boolean(obj.imageMimeType);
  obj.hasReceipt = Boolean(obj.receiptMimeType);
  return obj;
}

async function assertMembership(chatId, userId) {
  const chat = await Chat.findById(chatId);
  if (!chat) return { error: { status: 404, message: 'Chat not found' } };
  if (!chat.participants.map(String).includes(String(userId))) return { error: { status: 403, message: 'Forbidden' } };
  return { chat };
}

exports.listByChat = async (req, res) => {
  const { chatId } = req.params;
  console.log('[MSG][LIST][START]', { chatId, userId: req.user.id });
  const check = await assertMembership(chatId, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });
  const messages = await Message.find({ chat: chatId })
    .sort({ createdAt: 1 })
    .select('-imageBase64 -receiptBase64');
  const payload = messages.map((m) => {
    const obj = m.toObject();
    obj.hasImage = Boolean(obj.imageMimeType);
    obj.hasReceipt = Boolean(obj.receiptMimeType);
    return obj;
  });
  console.log('[MSG][LIST][OK]', { chatId, count: payload.length });
  res.json(payload);
};

exports.createText = async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Content required' });
  console.log('[MSG][CREATE_TEXT][START]', { chatId, userId: req.user.id });
  const check = await assertMembership(chatId, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });
  const message = await Message.create({ chat: chatId, sender: req.user.id, type: 'text', content });
  const pub = toPublicMessage(message);
  getIO().to(chatId.toString()).emit('message:new', pub);
  console.log('[MSG][CREATE_TEXT][OK]', { chatId, messageId: message._id.toString() });
  res.status(201).json(pub);
};

exports.createImage = async (req, res) => {
  const { chatId } = req.params;
  console.log('[MSG][CREATE_IMAGE][START]', { chatId, userId: req.user.id });
  const check = await assertMembership(chatId, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });

  let base64 = null;
  let mime = null;

  if (req.file) {
    base64 = req.file.buffer.toString('base64');
    mime = req.file.mimetype;
  } else if (req.body && req.body.imageBase64) {
    const raw = req.body.imageBase64;
    const match = /^data:(.*?);base64,(.*)$/.exec(raw);
    if (match) {
      mime = match[1];
      base64 = match[2];
    } else {
      base64 = raw;
      mime = req.body.imageMimeType || 'application/octet-stream';
    }
  }

  if (!base64 || !mime) return res.status(400).json({ message: 'Image file (multipart) or imageBase64 is required' });

  const message = await Message.create({
    chat: chatId,
    sender: req.user.id,
    type: 'image',
    imageBase64: base64,
    imageMimeType: mime,
  });
  const pub = toPublicMessage(message);
  const room = chatId.toString();
  getIO().to(room).emit('message:new', pub);
  console.log('[MSG][CREATE_IMAGE][OK]', { chatId, messageId: message._id.toString() });
  res.status(201).json(pub);
};

exports.createPayment = async (req, res) => {
  const { chatId } = req.params;
  const { amountUsd = 0, amountCny = 0 } = req.body;
  const usd = Number(amountUsd) || 0;
  const cny = Number(amountCny) || 0;
  console.log('[MSG][CREATE_PAYMENT][START]', { chatId, userId: req.user.id, usd, cny });

  let receiptBase64 = null;
  let receiptMimeType = null;
  if (req.file) {
    receiptBase64 = req.file.buffer.toString('base64');
    receiptMimeType = req.file.mimetype;
  } else if (req.body && req.body.receiptBase64) {
    const raw = req.body.receiptBase64;
    const match = /^data:(.*?);base64,(.*)$/.exec(raw);
    if (match) {
      receiptMimeType = match[1];
      receiptBase64 = match[2];
    } else {
      receiptBase64 = raw;
      receiptMimeType = req.body.receiptMimeType || 'application/octet-stream';
    }
  }

  if (usd <= 0 && cny <= 0 && !receiptBase64) {
    return res.status(400).json({ message: 'Provide amountUsd and/or amountCny > 0, or a receipt image' });
  }

  const check = await assertMembership(chatId, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });

  const message = await Message.create({
    chat: chatId,
    sender: req.user.id,
    type: 'payment',
    amountUsd: usd,
    amountCny: cny,
    receiptBase64,
    receiptMimeType,
    status: 'pending',
  });

  if (usd > 0 || cny > 0) {
    check.chat.pendingUsd += usd;
    check.chat.pendingCny += cny;
    await check.chat.save();
  }

  const pub = toPublicMessage(message);
  const payload = { message: pub, chat: check.chat };
  const room = chatId.toString();
  getIO().to(room).emit('payment:pending', payload);
  getIO().to(room).emit('chat:balanceUpdated', check.chat);
  console.log('[MSG][CREATE_PAYMENT][OK]', { chatId, messageId: message._id.toString(), usd, cny });
  res.status(201).json(payload);
};

exports.confirmPayment = async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.id;
  console.log('[MSG][CONFIRM_PAYMENT][START]', { chatId, messageId, userId });
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ message: 'Chat not found' });
  if (String(chat.creator) !== String(userId)) return res.status(403).json({ message: 'Only chat creator can confirm payments' });
  const message = await Message.findById(messageId);
  if (!message || String(message.chat) !== String(chatId)) return res.status(404).json({ message: 'Payment message not found' });
  if (message.type !== 'payment') return res.status(400).json({ message: 'Not a payment message' });
  if (message.status !== 'pending') return res.status(400).json({ message: 'Payment already confirmed' });

  chat.pendingUsd -= message.amountUsd;
  chat.pendingCny -= message.amountCny;
  chat.balanceUsd -= message.amountUsd;
  chat.balanceCny -= message.amountCny;
  if (chat.pendingUsd < 0) chat.pendingUsd = 0;
  if (chat.pendingCny < 0) chat.pendingCny = 0;

  message.status = 'confirmed';
  message.approvedBy = userId;
  message.approvedAt = new Date();

  await chat.save();
  await message.save();

  const room = chatId.toString();
  const payload = { message: toPublicMessage(message), chat };
  getIO().to(room).emit('payment:confirmed', payload);
  getIO().to(room).emit('chat:balanceUpdated', chat);
  console.log('[MSG][CONFIRM_PAYMENT][OK]', { chatId, messageId });
  res.json(payload);
};

exports.getImage = async (req, res) => {
  const { messageId } = req.params;
  console.log('[MSG][GET_IMAGE][START]', { messageId, userId: req.user.id });
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: 'Message not found' });
  const check = await assertMembership(message.chat, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });
  if (message.type !== 'image' || !message.imageBase64) return res.status(404).json({ message: 'Image not available' });
  const buf = Buffer.from(message.imageBase64, 'base64');
  res.setHeader('Content-Type', message.imageMimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buf.length);
  console.log('[MSG][GET_IMAGE][OK]', { messageId });
  return res.send(buf);
};

exports.getReceipt = async (req, res) => {
  const { messageId } = req.params;
  console.log('[MSG][GET_RECEIPT][START]', { messageId, userId: req.user.id });
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: 'Message not found' });
  const check = await assertMembership(message.chat, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });
  if (message.type !== 'payment' || !message.receiptBase64) return res.status(404).json({ message: 'Receipt not available' });
  const buf = Buffer.from(message.receiptBase64, 'base64');
  res.setHeader('Content-Type', message.receiptMimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buf.length);
  console.log('[MSG][GET_RECEIPT][OK]', { messageId });
  return res.send(buf);
};
