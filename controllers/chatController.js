const Chat = require('../models/Chat');
const Message = require('../models/Message');

exports.createChat = async (req, res) => {
  try {
    const { name, participantIds = [], initialBalanceUsd = 0, initialBalanceCny = 0 } = req.body;
    const creatorId = req.user.id;
    console.log('[CHAT][CREATE][START]', { creatorId, name, participantCount: participantIds?.length || 0 });
    const participantsSet = new Set(participantIds.map(String));
    participantsSet.add(String(creatorId));
    const participants = Array.from(participantsSet);

    const chat = await Chat.create({
      name,
      creator: creatorId,
      participants,
      balanceUsd: Number(initialBalanceUsd) || 0,
      balanceCny: Number(initialBalanceCny) || 0,
      pendingUsd: 0,
      pendingCny: 0,
    });

    console.log('[CHAT][CREATE][OK]', { chatId: chat._id.toString(), creatorId });
    res.status(201).json(chat);
  } catch (err) {
    console.error('[CHAT][CREATE][ERR]', err?.message || err);
    res.status(500).json({ message: 'Create chat failed' });
  }
};

exports.listMyChats = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[CHAT][LIST][START]', { userId });
    const chats = await Chat.find({ participants: userId }).sort({ updatedAt: -1 });
    console.log('[CHAT][LIST][OK]', { userId, count: chats.length });
    res.json(chats);
  } catch (err) {
    console.error('[CHAT][LIST][ERR]', err?.message || err);
    res.status(500).json({ message: 'Failed to list chats' });
  }
};

// List all public chats (including ones the current user has already joined)
exports.listDiscoverChats = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[CHAT][DISCOVER][START]', { userId });
    const chats = await Chat.find({}).sort({ updatedAt: -1 });
    console.log('[CHAT][DISCOVER][OK]', { userId, count: chats.length });
    res.json(chats);
  } catch (err) {
    console.error('[CHAT][DISCOVER][ERR]', err?.message || err);
    res.status(500).json({ message: 'Failed to list discoverable chats' });
  }
};

exports.getChat = async (req, res) => {
  try {
    console.log('[CHAT][GET][START]', { chatId: req.params.chatId, userId: req.user.id });
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.participants.map(String).includes(String(req.user.id))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    console.log('[CHAT][GET][OK]', { chatId: chat._id.toString(), userId: req.user.id });
    res.json(chat);
  } catch (err) {
    console.error('[CHAT][GET][ERR]', err?.message || err);
    res.status(500).json({ message: 'Failed to get chat' });
  }
};

// Join a chat: add current user to participants if not already present
exports.joinChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    console.log('[CHAT][JOIN][START]', { chatId, userId });
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const alreadyParticipant = chat.participants.map(String).includes(String(userId));
    if (alreadyParticipant) {
      console.log('[CHAT][JOIN][ALREADY]', { chatId, userId });
      return res.json(chat);
    }

    chat.participants.push(userId);
    await chat.save();
    console.log('[CHAT][JOIN][OK]', { chatId, userId });
    res.json(chat);
  } catch (err) {
    console.error('[CHAT][JOIN][ERR]', err?.message || err);
    res.status(500).json({ message: 'Failed to join chat' });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    console.log('[CHAT][DELETE][START]', { chatId, userId });
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (String(chat.creator) !== String(userId)) {
      return res.status(403).json({ message: 'Only the creator can delete this chat' });
    }
    // Delete related messages first
    const msgResult = await Message.deleteMany({ chat: chat._id });
    await chat.deleteOne();
    console.log('[CHAT][DELETE][OK]', { chatId, messagesDeleted: msgResult?.deletedCount || 0 });
    return res.json({ message: 'Chat deleted' });
  } catch (err) {
    console.error('[CHAT][DELETE][ERR]', err?.message || err);
    return res.status(500).json({ message: 'Failed to delete chat' });
  }
};
