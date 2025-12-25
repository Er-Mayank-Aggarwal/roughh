const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const pc = new RTCPeerConnection(config);
let teacherId = null;
let answered = false;

socket.emit("join", "student");

socket.on("teacher-id", id => {
  teacherId = id;
});

pc.ontrack = e => {
  console.log("✅ Track received");
  const video = document.getElementById("remoteVideo");
  video.srcObject = e.streams[0];
};

pc.onicecandidate = e => {
  if (e.candidate && teacherId) {
    socket.emit("ice", {
      target: teacherId,
      candidate: e.candidate
    });
  }
};

socket.on("offer", async offer => {
  if (answered) return;
  answered = true;

  console.log("📨 Offer received");

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", { answer });
});

socket.on("ice", candidate => {
  pc.addIceCandidate(candidate);
});
