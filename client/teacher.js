const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let localStream;
const peers = {};

(async () => {
  socket.emit("join", "teacher");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  document.getElementById("localVideo").srcObject = localStream;
})();

socket.on("student-joined", async studentId => {
  const pc = new RTCPeerConnection(config);
  peers[studentId] = pc;

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice", {
        target: studentId,
        candidate: e.candidate
      });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", {
    target: studentId,
    offer
  });
});

socket.on("answer", ({ from, answer }) => {
  peers[from].setRemoteDescription(answer);
});

socket.on("ice", candidate => {
  Object.values(peers).forEach(p =>
    p.addIceCandidate(candidate)
  );
});
