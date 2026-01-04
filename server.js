const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);
const path = require("path");
app.use(express.static(path.join(__dirname, "client")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "index.html"));
});
const users = {};
const userRooms = {};
const userStatus = {};
io.on("connection", (socket) => {
  socket.on("join-room", (roomId, username, status) => {
    socket.join(roomId);
    users[socket.id] = username;
    userRooms[socket.id] = roomId;
    userStatus[socket.id] = status || { audio: false, video: false };
    socket.to(roomId).emit("user-connected", { userId: socket.id, username, status: userStatus[socket.id] });
    const existingUsers = [];
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      roomSockets.forEach(socketId => {
        if (socketId !== socket.id && users[socketId]) {
          existingUsers.push({
            userId: socketId,
            username: users[socketId],
            status: userStatus[socketId] || { audio: false, video: false }
          });
        }
      });
    }
    socket.emit("existing-users", existingUsers);
  });
  socket.on("disconnect1", () => {
    const roomId = userRooms[socket.id];
    if (roomId) {
      socket.to(roomId).emit("user-disconnected", socket.id);
    }
    delete users[socket.id];
    delete userRooms[socket.id];
    delete userStatus[socket.id];
  });
  socket.on("disconnect", () => {
    const roomId = userRooms[socket.id];
    if (roomId) {
      socket.to(roomId).emit("user-disconnected", socket.id);
    }
    delete users[socket.id];
    delete userRooms[socket.id];
    delete userStatus[socket.id];
  });
  socket.on("toggle-status", ({ type, status }) => {
    if (userStatus[socket.id]) {
      userStatus[socket.id][type] = status;
    }
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(roomId => {
      socket.to(roomId).emit("user-status-updated", {
        userId: socket.id,
        type,
        status
      });
    });
  });
  socket.on("signal", (data) => {
    io.to(data.target).emit("signal", {
      sender: socket.id,
      username: users[socket.id],
      payload: data.payload
    });
  });
});
server.listen(5500, () => console.log("Server running on port 5500"));