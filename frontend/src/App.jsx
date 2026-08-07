import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { 
  Send, Users, Tv, MessageSquare, Plus, LogIn, Film 
} from 'lucide-react';
import Background3D from './components/Background3D';
import { playSFX } from './utils/sfx';

const socket = io('https://spideycast-backend.onrender.com');

export default function App() {
  // Navigation & Auth State
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isHost, setIsHost] = useState(false);

  // Room State
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // Video Sync State
  const [videoUrl, setVideoUrl] = useState('');
  const [cloudInputUrl, setCloudInputUrl] = useState('');
  const [playing, setPlaying] = useState(true);
  const playerRef = useRef(null);

  // Helper function to safely get current player time across ReactPlayer and HTML5 Video
  const getPlayerTime = () => {
    if (!playerRef.current) return 0;
    if (typeof playerRef.current.getCurrentTime === 'function') {
      return playerRef.current.getCurrentTime();
    }
    if (typeof playerRef.current.currentTime === 'number') {
      return playerRef.current.currentTime;
    }
    return 0;
  };

  useEffect(() => {
    // Socket Event Listeners
    socket.on('room_update', (room) => {
      setMembers(room.members);
      if (room.videoState.url && !videoUrl) {
        setVideoUrl(room.videoState.url);
      }
    });

    socket.on('receive_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('video_source_changed', (url) => {
      setVideoUrl(url);
    });

    socket.on('apply_video_action', ({ action, currentTime }) => {
      if (playerRef.current) {
        const time = getPlayerTime();
        if (Math.abs(time - currentTime) > 1.5) {
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(currentTime, 'seconds');
          } else if ('currentTime' in playerRef.current) {
            playerRef.current.currentTime = currentTime;
          }
        }
        if (action === 'play') setPlaying(true);
        if (action === 'pause') setPlaying(false);
      }
    });

    return () => {
      socket.off('room_update');
      socket.off('receive_message');
      socket.off('video_source_changed');
      socket.off('apply_video_action');
    };
  }, [videoUrl]);

  // Handlers
  const handleCreateRoom = () => {
    if (!roomId || !password || !username) return alert('Fill all fields!');
    playSFX.click();
    socket.emit('create_room', { roomId, password, username }, (res) => {
      if (res.success) {
        setIsHost(true);
        setInRoom(true);
      } else alert(res.message);
    });
  };

  const handleJoinRoom = () => {
    if (!roomId || !password || !username) return alert('Fill all fields!');
    playSFX.click();
    socket.emit('join_room', { roomId, password, username }, (res) => {
      if (res.success) {
        setIsHost(res.isHost);
        setInRoom(true);
      } else alert(res.message);
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    playSFX.click();
    socket.emit('send_message', { roomId, message: chatInput });
    setChatInput('');
  };

  const handleSetCloudVideo = (e) => {
    e.preventDefault();
    if (!cloudInputUrl.trim()) return;
    playSFX.click();
    
    let processedUrl = cloudInputUrl.trim();

    // Auto-convert Google Drive view links to preview embed
    if (processedUrl.includes('drive.google.com')) {
      if (processedUrl.includes('/view')) {
        processedUrl = processedUrl.replace('/view', '/preview');
      } else if (!processedUrl.includes('/preview') && processedUrl.includes('/file/d/')) {
        const fileId = processedUrl.split('/file/d/')[1].split('/')[0];
        processedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    // Auto-convert TeraBox share links to embed format
    if (processedUrl.includes('terabox.com') || processedUrl.includes('1024tera.com')) {
      processedUrl = processedUrl.replace('terabox.com', 'terabox.app/embed');
    }

    socket.emit('update_video_source', { roomId, url: processedUrl });
    setCloudInputUrl('');
  };

  // Sync Event Actions
  const handlePlay = () => {
    setPlaying(true);
    if (isHost) {
      socket.emit('sync_video_action', { 
        roomId, 
        action: 'play', 
        currentTime: getPlayerTime() 
      });
    }
  };

  const handlePause = () => {
    setPlaying(false);
    if (isHost) {
      socket.emit('sync_video_action', { 
        roomId, 
        action: 'pause', 
        currentTime: getPlayerTime() 
      });
    }
  };

  const handleSeek = (seconds) => {
    if (isHost) {
      socket.emit('sync_video_action', { 
        roomId, 
        action: 'seek', 
        currentTime: typeof seconds === 'number' ? seconds : getPlayerTime() 
      });
    }
  };

  // Helper check for embed-only cloud services (Drive / TeraBox)
  const isEmbedUrl = videoUrl.includes('drive.google.com') || videoUrl.includes('tera');

  return (
    <div className="relative min-h-screen bg-spidey-dark text-white flex flex-col font-sans overflow-hidden">
      <Background3D />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 bg-spidey-card/60 backdrop-blur-md border-b border-spidey-red/20">
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center space-x-3 cursor-pointer"
          onMouseEnter={playSFX.hover}
        >
          <div className="p-2 bg-spidey-red rounded-xl shadow-lg shadow-spidey-red/50">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-spidey-red via-white to-spidey-cyan">
            SPIDEYCAST
          </span>
        </motion.div>

        {inRoom && (
          <div className="flex items-center space-x-4 bg-black/40 px-4 py-2 rounded-full border border-spidey-red/30">
            <span className="text-xs uppercase text-gray-400 font-bold">Room:</span>
            <span className="text-sm font-bold text-spidey-cyan">{roomId}</span>
          </div>
        )}
      </header>

      {/* Main Content View */}
      {!inRoom ? (
        // JOIN / CREATE ROOM MODAL
        <main className="relative z-10 flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-spidey-card/80 backdrop-blur-xl p-8 rounded-3xl border border-spidey-red/30 shadow-2xl shadow-spidey-red/10"
          >
            <h2 className="text-3xl font-extrabold text-center mb-6 text-white tracking-wide">
              ENTER THE MULTIVERSE
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Your Name</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Spider-Man..."
                  className="w-full mt-1 px-4 py-3 bg-black/50 border border-gray-800 rounded-xl focus:outline-none focus:border-spidey-red transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Room ID</label>
                <input 
                  type="text" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Spidey-Room-123"
                  className="w-full mt-1 px-4 py-3 bg-black/50 border border-gray-800 rounded-xl focus:outline-none focus:border-spidey-red transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1 px-4 py-3 bg-black/50 border border-gray-800 rounded-xl focus:outline-none focus:border-spidey-red transition"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button 
                  onClick={handleCreateRoom}
                  onMouseEnter={playSFX.hover}
                  className="flex-1 py-3 bg-spidey-red hover:bg-spidey-darkRed text-white font-bold rounded-xl shadow-lg shadow-spidey-red/40 transition flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Create</span>
                </button>

                <button 
                  onClick={handleJoinRoom}
                  onMouseEnter={playSFX.hover}
                  className="flex-1 py-3 bg-spidey-blue hover:bg-slate-800 border border-spidey-cyan/30 text-white font-bold rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-5 h-5 text-spidey-cyan" />
                  <span>Join</span>
                </button>
              </div>
            </div>
          </motion.div>
        </main>
      ) : (
        // DASHBOARD VIEW (VIDEO PLAYER + MEMBERS + CHAT)
        <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 h-[calc(100vh-80px)]">
          
          {/* VIDEO STAGE */}
          <section className="lg:col-span-3 flex flex-col space-y-4">
            <div className="relative flex-1 bg-black/80 rounded-3xl border border-spidey-red/30 overflow-hidden shadow-2xl flex items-center justify-center min-h-[400px]">
              {videoUrl ? (
                isEmbedUrl ? (
                  // Google Drive / TeraBox Embed Player
                  <iframe
                    src={videoUrl}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen"
                    title="SpideyCast Stream"
                  />
                ) : (
                  // Universal React Player (YouTube, Direct MP4, WebM, HLS)
                  <ReactPlayer
                    ref={playerRef}
                    url={videoUrl}
                    playing={playing}
                    controls={isHost}
                    width="100%"
                    height="100%"
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeek={(seconds) => handleSeek(seconds)}
                  />
                )
              ) : (
                <div className="text-center p-8">
                  <Film className="w-16 h-16 text-spidey-red animate-pulse mx-auto mb-4" />
                  <p className="text-xl font-bold text-gray-300">No Stream Active</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {isHost ? 'Paste a YouTube, Google Drive, or MP4 link below.' : 'Waiting for host to play video...'}
                  </p>
                </div>
              )}
            </div>

            {/* HOST CONTROLLER PANEL */}
            {isHost && (
              <form onSubmit={handleSetCloudVideo} className="flex space-x-3 bg-spidey-card/90 p-4 rounded-2xl border border-spidey-red/30">
                <input 
                  type="url"
                  value={cloudInputUrl}
                  onChange={(e) => setCloudInputUrl(e.target.value)}
                  placeholder="Paste YouTube, Drive, TeraBox, or MP4 link here..."
                  className="flex-1 bg-black/60 border border-gray-800 px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-spidey-red"
                />
                <button 
                  type="submit"
                  onMouseEnter={playSFX.hover}
                  className="px-6 py-2 bg-spidey-red font-bold rounded-xl text-sm shadow-md hover:bg-spidey-darkRed transition"
                >
                  Cast Video
                </button>
              </form>
            )}
          </section>

          {/* SIDE PANEL: MEMBERS & CHAT */}
          <aside className="flex flex-col space-y-4 h-full overflow-hidden">
            
            {/* Active Members Card */}
            <div className="bg-spidey-card/80 p-4 rounded-2xl border border-spidey-red/20 backdrop-blur-md">
              <div className="flex items-center space-x-2 text-xs font-bold text-spidey-cyan mb-3 uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>Web-Cast Members ({members.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {members.map((m) => (
                  <span 
                    key={m.id}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      m.isHost 
                        ? 'bg-spidey-red/20 border-spidey-red text-spidey-red font-bold' 
                        : 'bg-black/40 border-gray-800 text-gray-300'
                    }`}
                  >
                    {m.username} {m.isHost && '👑'}
                  </span>
                ))}
              </div>
            </div>

            {/* Real-time Chat Container */}
            <div className="flex-1 bg-spidey-card/80 p-4 rounded-2xl border border-spidey-red/20 backdrop-blur-md flex flex-col overflow-hidden">
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                <MessageSquare className="w-4 h-4 text-spidey-red" />
                <span>Live Multiverse Chat</span>
              </div>

              {/* Chat Messages List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="bg-black/40 p-3 rounded-xl border border-gray-800/60 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-spidey-cyan">{msg.sender}</span>
                      <span className="text-[10px] text-gray-500">{msg.time}</span>
                    </div>
                    <p className="text-gray-200">{msg.text}</p>
                  </div>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-black/60 border border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-spidey-red"
                />
                <button 
                  type="submit"
                  onMouseEnter={playSFX.hover}
                  className="p-2 bg-spidey-red rounded-xl hover:bg-spidey-darkRed transition"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}