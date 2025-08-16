const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { getIO } = require('../sockets/io');
const BalanceTransaction = require('../models/BalanceTransaction');
const { Readable } = require('stream');

function toPublicMessage(m) {
  const obj = m.toObject ? m.toObject() : m;
  // Reconstruct inline data URLs for client rendering
  if (obj.imageBase64 && obj.imageMimeType) {
    obj.imageData = `data:${obj.imageMimeType};base64,${obj.imageBase64}`;
  }
  if (obj.receiptBase64 && obj.receiptMimeType) {
    obj.receiptData = `data:${obj.receiptMimeType};base64,${obj.receiptBase64}`;
  }
  delete obj.imageBase64;
  delete obj.receiptBase64;
  obj.hasImage = Boolean(obj.imageMimeType);
  obj.hasReceipt = Boolean(obj.receiptMimeType);
  obj.hasVoice = Boolean(obj.voiceFileId);
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
    .sort({ createdAt: 1 });
  // Build public-safe payload including data URLs when applicable
  const payload = messages.map((m) => toPublicMessage(m));
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

exports.createVoice = async (req, res) => {
  const { chatId } = req.params;
  const duration = Number(req.body?.duration || 0);
  console.log('[MSG][CREATE_VOICE][START]', { chatId, userId: req.user.id, duration });

  const check = await assertMembership(chatId, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Audio file is required' });
  }

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'voice' });
  const filename = `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const contentType = req.file.mimetype || 'audio/mpeg';
  const metadata = {
    chatId,
    userId: req.user.id,
    duration,
  };

  const readable = Readable.from(req.file.buffer);
  const uploadStream = bucket.openUploadStream(filename, { contentType, metadata });

  try {
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
      readable.pipe(uploadStream);
    });
  } catch (e) {
    console.error('[MSG][CREATE_VOICE][ERR]', e?.message);
    return res.status(500).json({ message: 'Failed to save voice to storage' });
  }

  const fileId = uploadStream.id;

  const message = await Message.create({
    chat: chatId,
    sender: req.user.id,
    type: 'voice',
    voiceFileId: fileId,
    voiceMimeType: contentType,
    voiceDuration: duration > 0 ? duration : undefined,
  });

  const pub = toPublicMessage(message);
  const room = chatId.toString();
  getIO().to(room).emit('message:new', pub);
  console.log('[MSG][CREATE_VOICE][OK]', { chatId, messageId: message._id.toString() });
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
  const { amountUsd = 0, amountCny = 0, note } = req.body;
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
  const isCreator = String(check.chat.creator) === String(req.user.id);

  // Compose a display content string so clients don't need to reconstruct the message text
  const parts = [];
  if (usd > 0) parts.push(`$${usd}`);
  if (cny > 0) parts.push(`¥${cny}`);
  const amountText = parts.join(' / ');
  const prefix = isCreator ? 'Payment alert' : 'Payment request';
  const baseContent = amountText ? `${prefix}: ${amountText}` : prefix;
  const contentStr = note ? `${baseContent} - ${note}` : baseContent;

  const message = await Message.create({
    chat: chatId,
    sender: req.user.id,
    type: 'payment',
    content: contentStr,
    amountUsd: usd,
    amountCny: cny,
    receiptBase64,
    receiptMimeType,
    isCreatorRequest: isCreator,
    status: 'pending',
  });

  // Only non-creator payments should affect pending balances
  if (!isCreator && (usd > 0 || cny > 0)) {
    check.chat.pendingUsd += usd;
    check.chat.pendingCny += cny;
    await check.chat.save();
  }

  const pub = toPublicMessage(message);
  const payload = { message: pub, chat: check.chat };
  const room = chatId.toString();
  getIO().to(room).emit('payment:pending', payload);
  // Emit balance update only if pending changed
  if (!isCreator && (usd > 0 || cny > 0)) {
    getIO().to(room).emit('chat:balanceUpdated', check.chat);
  }
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
  if (message.isCreatorRequest) return res.status(400).json({ message: 'Creator alerts cannot be confirmed' });

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

  // Record a transaction for confirmed payment
  try {
    await BalanceTransaction.create({
      chat: chatId,
      type: 'payment',
      deltaUsd: -Number(message.amountUsd || 0),
      deltaCny: -Number(message.amountCny || 0),
      createdBy: message.sender, // who paid
      message: message._id,
    });
  } catch (e) {
    console.error('[TX][CREATE][ERR]', e?.message);
  }

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

exports.getVoice = async (req, res) => {
  const { messageId } = req.params;
  console.log('[MSG][GET_VOICE][START]', { messageId, userId: req.user.id });
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: 'Message not found' });
  const check = await assertMembership(message.chat, req.user.id);
  if (check.error) return res.status(check.error.status).json({ message: check.error.message });
  if (message.type !== 'voice' || !message.voiceFileId) return res.status(404).json({ message: 'Voice not available' });

  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'voice' });
    // get file info to set headers
    const cursor = bucket.find({ _id: message.voiceFileId });
    const files = await cursor.toArray();
    const fileInfo = files && files[0];
    const contentType = fileInfo?.contentType || message.voiceMimeType || 'application/octet-stream';
    if (fileInfo?.length) res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Content-Type', contentType);

    const stream = bucket.openDownloadStream(message.voiceFileId);
    stream.on('error', (err) => {
      console.error('[MSG][GET_VOICE][ERR]', err?.message);
      if (!res.headersSent) res.status(404).json({ message: 'Voice stream error' });
    });
    stream.pipe(res);
  } catch (e) {
    console.error('[MSG][GET_VOICE][ERR]', e?.message);
    return res.status(500).json({ message: 'Failed to stream voice' });
  }
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
