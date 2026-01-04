const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let localStream;
const peers = {}; // Map: studentId -> RTCPeerConnection

// 1. Initialize Teacher Media (Low Latency)
(async () => {
  try {
    socket.emit("join", "teacher");

    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15, max: 20 }
      },
      audio: true
    });

    document.getElementById("localVideo").srcObject = localStream;
    console.log("✅ Teacher media ready");
  } catch(e) {
    console.error("Camera failed", e);
    alert("Please allow camera access.");
  }
})();

// 2. Handle New Student
socket.on("student-joined", async studentId => {
  console.log(`NEW STUDENT: ${studentId}`);
  const pc = new RTCPeerConnection(config);
  peers[studentId] = pc;

  // Send Teacher stream
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Receive Student stream
  pc.ontrack = e => {
    console.log(`📺 Received track from ${studentId}`);
    const grid = document.getElementById("video-grid");
    
    // Prevent duplicates
    let vidWrapper = document.getElementById(`wrapper-${studentId}`);
    
    if (!vidWrapper) {
      vidWrapper = document.createElement("div");
      vidWrapper.className = "video-wrapper";
      vidWrapper.id = `wrapper-${studentId}`;
      
      const vid = document.createElement("video");
      vid.autoplay = true;
      vid.playsInline = true;
      vid.srcObject = e.streams[0];
      
      // IMPORTANT: Autoplay fix
      vid.onloadedmetadata = () => {
        vid.play().catch(e => console.error("Play error:", e));
      };
      
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = `Student ${studentId.substr(0,4)}`;

      vidWrapper.appendChild(vid);
      vidWrapper.appendChild(label);
      grid.appendChild(vidWrapper);
    }
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice", { target: studentId, candidate: e.candidate });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", { target: studentId, offer });
});

socket.on("answer", ({ from, answer }) => {
  if (peers[from]) {
    peers[from].setRemoteDescription(answer);
  }
});

socket.on("ice", candidate => {
  Object.values(peers).forEach(p => p.addIceCandidate(candidate).catch(e => {}));
});