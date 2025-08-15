const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    console.log('[SOCKET][CONNECT]', { socketId: socket.id });
    socket.on('joinChat', (chatId) => {
      if (chatId) {
        const room = chatId.toString();
        socket.join(room);
        console.log('[SOCKET][JOIN]', { socketId: socket.id, room });
      }
    });
    socket.on('leaveChat', (chatId) => {
      if (chatId) {
        const room = chatId.toString();
        socket.leave(room);
        console.log('[SOCKET][LEAVE]', { socketId: socket.id, room });
      }
    });
    socket.on('disconnect', (reason) => {
      console.log('[SOCKET][DISCONNECT]', { socketId: socket.id, reason });
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { initSocket, getIO };
