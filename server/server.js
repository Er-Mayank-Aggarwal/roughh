const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const path = require("path");

app.use(express.static(path.join(__dirname, "../client")));

let teacherId = null;

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("join", role => {
    if (role === "teacher") {
      teacherId = socket.id;
      console.log("Teacher set:", teacherId);
    } else {
      console.log("Student joined:", socket.id);
      io.to(teacherId).emit("student-joined", socket.id);
      socket.emit("teacher-id", teacherId);
    }
  });

  socket.on("offer", ({ target, offer }) => {
    io.to(target).emit("offer", offer);
  });

  socket.on("answer", ({ answer }) => {
    io.to(teacherId).emit("answer", {
      from: socket.id,
      answer
    });
  });

  socket.on("ice", ({ target, candidate }) => {
    io.to(target).emit("ice", candidate);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (socket.id === teacherId) {
      teacherId = null;
      console.log("Teacher left, reset");
    }
  });
});

server.listen(5000, () =>
  console.log("Signaling server running on http://localhost:5000")
);
