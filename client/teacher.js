const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let localStream = null;
const peers = {}; 

// 1. Ensure Camera is Ready BEFORE connecting
async function initTeacher() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, frameRate: 15 },
      audio: true
    });
    
    document.getElementById("localVideo").srcObject = localStream;
    socket.emit("join", "teacher");
    console.log("✅ Teacher Online");
    
  } catch (err) {
    console.error("Camera Fail:", err);
    alert("Camera access denied. Check HTTPS/Permissions.");
  }
}

initTeacher();

socket.on("student-joined", async studentId => {
  console.log(`👨‍🎓 Student joined: ${studentId}`);
  
  if (!localStream) {
    console.error("❌ Cannot connect: Camera not ready yet");
    return;
  }

  const pc = new RTCPeerConnection(config);
  peers[studentId] = pc;

  // Add Tracks
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Handle Incoming Student Video
  pc.ontrack = e => {
    const grid = document.getElementById("video-grid");
    
    if (document.getElementById(`vid-${studentId}`)) return; // No duplicates

    console.log(`📺 Video from ${studentId}`);
    
    const wrapper = document.createElement("div");
    wrapper.className = "video-wrapper";
    
    const vid = document.createElement("video");
    vid.id = `vid-${studentId}`;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.muted = true; // IMPORTANT: Muted prevents black screen on autoplay
    vid.srcObject = e.streams[0];
    
    // DEBUG: Check if video is actually drawing
    vid.addEventListener("resize", () => {
        console.log(`📏 Video dimensions updated: ${vid.videoWidth}x${vid.videoHeight}`);
    });

    const label = document.createElement("div");
    label.className = "label";
    label.innerText = `Student ${studentId.substr(0,4)}`;

    wrapper.appendChild(vid);
    wrapper.appendChild(label);
    grid.appendChild(wrapper);
    
    vid.play().catch(console.error);
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
    peers[from].setRemoteDescription(answer).catch(console.error);
  }
});

socket.on("ice", candidate => {
  Object.values(peers).forEach(p => p.addIceCandidate(candidate).catch(e => {}));
});