import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-Memory Room Data
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', ({ roomId, password, username }, callback) => {
    if (rooms[roomId]) {
      return callback({ success: false, message: 'Room already exists!' });
    }

    rooms[roomId] = {
      password,
      hostId: socket.id,
      isSharingScreen: false,
      videoState: { url: '', currentTime: 0, playing: true },
      members: [{ id: socket.id, username, isHost: true }]
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    callback({ success: true });
    io.to(roomId).emit('room_update', rooms[roomId]);
  });

  // 2. Join Room
  socket.on('join_room', ({ roomId, password, username }, callback) => {
    const room = rooms[roomId];

    if (!room) {
      return callback({ success: false, message: 'Room not found!' });
    }

    if (room.password !== password) {
      return callback({ success: false, message: 'Invalid password!' });
    }

    room.members.push({ id: socket.id, username, isHost: false });
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    callback({ 
      success: true, 
      isHost: false, 
      isSharingScreen: room.isSharingScreen, 
      hostId: room.hostId 
    });

    io.to(roomId).emit('room_update', room);
  });

  // 3. WebRTC Direct Peer-to-Peer Signaling Handlers
  socket.on('request_stream', ({ hostId }) => {
    io.to(hostId).emit('request_stream', { requesterId: socket.id });
  });

  socket.on('webrtc_offer', ({ offer, targetId }) => {
    io.to(targetId).emit('webrtc_offer', { offer, senderId: socket.id });
  });

  socket.on('webrtc_answer', ({ answer, targetId }) => {
    io.to(targetId).emit('webrtc_answer', { answer, senderId: socket.id });
  });

  socket.on('webrtc_ice', ({ candidate, targetId }) => {
    io.to(targetId).emit('webrtc_ice', { candidate, senderId: socket.id });
  });

  // 4. Screen Share Toggle Events
  socket.on('start_screen_share', ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].isSharingScreen = true;
      socket.to(roomId).emit('screen_share_started', { hostId: socket.id });
    }
  });

  socket.on('stop_screen_share', ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].isSharingScreen = false;
      socket.to(roomId).emit('screen_share_stopped');
    }
  });

  // 5. Video Source & Playback Synchronization
  socket.on('update_video_source', ({ roomId, url }) => {
    if (rooms[roomId]) {
      rooms[roomId].videoState.url = url;
      rooms[roomId].isSharingScreen = false;
      io.to(roomId).emit('video_source_changed', url);
      io.to(roomId).emit('room_update', rooms[roomId]);
    }
  });

  socket.on('sync_video_action', ({ roomId, action, currentTime }) => {
    if (rooms[roomId]) {
      rooms[roomId].videoState.currentTime = currentTime;
      socket.to(roomId).emit('apply_video_action', { action, currentTime });
    }
  });

  // 6. Live Chat
  socket.on('send_message', ({ roomId, message }) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.to(roomId).emit('receive_message', {
      id: Date.now(),
      sender: socket.username || 'Anonymous',
      text: message,
      time
    });
  });

  // 7. Handle Disconnections
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].members = rooms[roomId].members.filter((m) => m.id !== socket.id);

      if (rooms[roomId].members.length === 0) {
        delete rooms[roomId];
      } else {
        if (socket.id === rooms[roomId].hostId) {
          rooms[roomId].hostId = rooms[roomId].members[0].id;
          rooms[roomId].members[0].isHost = true;
        }
        io.to(roomId).emit('room_update', rooms[roomId]);
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});