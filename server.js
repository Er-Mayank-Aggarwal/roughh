const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);
const path = require("path");

app.use(express.static(path.join(__dirname, "client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "student.html"));
});

io.on("connection", (socket) => {
  // 1. Join Room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined: ${socket.id}`);
    
    // Broadcast to others: "Hey, I am here (socket.id)"
    socket.to(roomId).emit("user-connected", socket.id);

    // Handle Disconnect
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });

  // 2. Relay Signals (Offer, Answer, ICE)
  // We use 'io.to()' which REQUIRES the real Socket ID
  socket.on("signal", (data) => {
    io.to(data.target).emit("signal", {
      sender: socket.id, // The server knows who sent it
      payload: data.payload
    });
  });
});

server.listen(5500, () => console.log("✅ Server running on port 5500"));