import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map to store room states in memory
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ roomId, password, username }, callback) => {
    if (rooms.has(roomId)) {
      return callback({ success: false, message: 'Room ID already exists!' });
    }

    const roomData = {
      password,
      hostId: socket.id,
      isSharingScreen: false,
      videoState: { url: '', currentTime: 0, isPlaying: false },
      members: [{ id: socket.id, username, isHost: true }]
    };

    rooms.set(roomId, roomData);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    callback({ success: true, isHost: true });
    io.to(roomId).emit('room_update', roomData);
  });

  // Join Room
  socket.on('join_room', ({ roomId, password, username }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      return callback({ success: false, message: 'Room not found!' });
    }

    if (room.password !== password) {
      return callback({ success: false, message: 'Incorrect Password!' });
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    const newMember = { id: socket.id, username, isHost: false };
    room.members.push(newMember);

    callback({ 
      success: true, 
      isHost: false, 
      videoState: room.videoState,
      isSharingScreen: room.isSharingScreen 
    });

    io.to(roomId).emit('room_update', room);
    io.to(roomId).emit('user_joined', { username });
  });

  // Chat Handler
  socket.on('send_message', ({ roomId, message }) => {
    io.to(roomId).emit('receive_message', {
      id: Date.now(),
      sender: socket.username,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Video Streaming Handlers (Host Only)
  socket.on('update_video_source', ({ roomId, url }) => {
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      room.videoState.url = url;
      room.videoState.currentTime = 0;
      room.videoState.isPlaying = true;
      room.isSharingScreen = false; // Reset screen share mode if new link is played
      io.to(roomId).emit('video_source_changed', url);
    }
  });

  socket.on('sync_video_action', ({ roomId, action, currentTime }) => {
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      room.videoState.currentTime = currentTime;
      if (action === 'play') room.videoState.isPlaying = true;
      if (action === 'pause') room.videoState.isPlaying = false;

      socket.to(roomId).emit('apply_video_action', { action, currentTime });
    }
  });

  // WebRTC Screen Share Handlers (Host Only)
 // WebRTC Screen Share Handlers
socket.on('start_screen_share', ({ roomId, hostPeerId }) => {
  const room = rooms.get(roomId);
  if (room && room.hostId === socket.id) {
    room.isSharingScreen = true;
    socket.to(roomId).emit('screen_share_started', { hostPeerId });
  }
});

  socket.on('stop_screen_share', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      room.isSharingScreen = false;
      socket.to(roomId).emit('screen_share_stopped');
    }
  });

  // Disconnection Handler
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      
      // If host disconnects during active screen share, stop screen share
      if (room.hostId === socket.id && room.isSharingScreen) {
        room.isSharingScreen = false;
        io.to(roomId).emit('screen_share_stopped');
      }

      room.members = room.members.filter((m) => m.id !== socket.id);

      if (room.members.length === 0) {
        rooms.delete(roomId);
      } else {
        // Re-assign host privileges to next member if host left
        if (room.hostId === socket.id) {
          room.hostId = room.members[0].id;
          room.members[0].isHost = true;
        }
        io.to(roomId).emit('room_update', room);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SpideyCast Backend running on port ${PORT}`);
});