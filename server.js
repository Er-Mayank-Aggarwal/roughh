const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const CONFIG = {
  port: process.env.PORT || 5500,
  clientPath: path.join(__dirname, "client")
};

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Set of socketIds
  }

  joinRoom(roomId, socketId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(socketId);
  }

  leaveRoom(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  getRoomUsers(roomId) {
    return this.rooms.get(roomId) || new Set();
  }

  getUserRoom(socketId, io) {
    // Get room from socket.io adapter
    const socketRooms = io.sockets.adapter.rooms;
    for (const [roomId, participants] of socketRooms) {
      if (roomId !== socketId && participants.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }
}

class UserManager {
  constructor() {
    this.users = new Map(); // socketId -> { username, roomId, status }
  }

  addUser(socketId, username, roomId, status = { audio: false, video: false }) {
    this.users.set(socketId, { username, roomId, status });
  }

  removeUser(socketId) {
    const user = this.users.get(socketId);
    this.users.delete(socketId);
    return user;
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  getUsername(socketId) {
    const user = this.users.get(socketId);
    return user ? user.username : null;
  }

  getRoomId(socketId) {
    const user = this.users.get(socketId);
    return user ? user.roomId : null;
  }

  getStatus(socketId) {
    const user = this.users.get(socketId);
    return user ? user.status : { audio: false, video: false };
  }

  updateStatus(socketId, type, status) {
    const user = this.users.get(socketId);
    if (user && user.status) {
      user.status[type] = status;
    }
  }

  getUsersInRoom(roomId, excludeSocketId = null) {
    const usersInRoom = [];
    for (const [socketId, userData] of this.users) {
      if (userData.roomId === roomId && socketId !== excludeSocketId) {
        usersInRoom.push({
          userId: socketId,
          username: userData.username,
          status: userData.status
        });
      }
    }
    return usersInRoom;
  }
}

class SignalingServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.roomManager = new RoomManager();
    this.userManager = new UserManager();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(express.static(CONFIG.clientPath));
  }

  setupRoutes() {
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(CONFIG.clientPath, "index.html"));
    });

    this.app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        connectedUsers: this.userManager.users.size
      });
    });
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);
      
      this.handleJoinRoom(socket);
      this.handleToggleStatus(socket);
      this.handleSignal(socket);
      this.handleDisconnect(socket);
    });
  }

  handleJoinRoom(socket) {
    socket.on("join-room", (roomId, username, status) => {
      if (!roomId || typeof roomId !== "string") {
        socket.emit("error", { message: "Invalid room ID" });
        return;
      }

      const sanitizedUsername = this.sanitizeUsername(username);
      const sanitizedStatus = this.validateStatus(status);

      socket.join(roomId);
      
      this.userManager.addUser(socket.id, sanitizedUsername, roomId, sanitizedStatus);
      this.roomManager.joinRoom(roomId, socket.id);

      console.log(`${sanitizedUsername} (${socket.id}) joined room: ${roomId}`);

      socket.to(roomId).emit("user-connected", {
        userId: socket.id,
        username: sanitizedUsername,
        status: sanitizedStatus
      });

      const existingUsers = this.userManager.getUsersInRoom(roomId, socket.id);
      socket.emit("existing-users", existingUsers);
    });
  }

  handleToggleStatus(socket) {
    socket.on("toggle-status", ({ type, status }) => {
      if (!["audio", "video"].includes(type)) {
        return;
      }

      const normalizedStatus = Boolean(status);
      this.userManager.updateStatus(socket.id, type, normalizedStatus);

      const roomId = this.userManager.getRoomId(socket.id);
      if (roomId) {
        socket.to(roomId).emit("user-status-updated", {
          userId: socket.id,
          type,
          status: normalizedStatus
        });
      }
    });
  }

  handleSignal(socket) {
    socket.on("signal", (data) => {
      if (!data || !data.target || !data.payload) {
        return;
      }

      const username = this.userManager.getUsername(socket.id);
      
      this.io.to(data.target).emit("signal", {
        sender: socket.id,
        username: username,
        payload: data.payload
      });
    });
  }

  handleDisconnect(socket) {
    const cleanup = () => {
      const user = this.userManager.getUser(socket.id);
      
      if (user && user.roomId) {
        console.log(`${user.username} (${socket.id}) left room: ${user.roomId}`);
        
        socket.to(user.roomId).emit("user-disconnected", socket.id);
        
        this.roomManager.leaveRoom(user.roomId, socket.id);
      }
      
      this.userManager.removeUser(socket.id);
    };

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      cleanup();
    });

    socket.on("disconnect1", () => {
      console.log(`User manually disconnected: ${socket.id}`);
      cleanup();
      socket.disconnect(true);
    });
  }

  sanitizeUsername(username) {
    if (!username || typeof username !== "string") {
      return "Guest";
    }
    return username.trim().slice(0, 20).replace(/[<>]/g, "") || "Guest";
  }

  validateStatus(status) {
    if (!status || typeof status !== "object") {
      return { audio: false, video: false };
    }
    return {
      audio: Boolean(status.audio),
      video: Boolean(status.video)
    };
  }

  start() {
    this.server.listen(CONFIG.port, () => {
      console.log(`
      Server running on port ${CONFIG.port}              
      http://localhost:${CONFIG.port}                
      `);
    });
  }
}

// ============== APPLICATION ENTRY POINT ==============
const server = new SignalingServer();
server.start();