const socket = io();
const videoGrid = document.getElementById("video-grid");
const peers = {}; // Connection storage

const roomId = "class-room-1"; 

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// 1. Get Local Media
navigator.mediaDevices.getUserMedia({
  video: { width: 320, height: 240, frameRate: 15 },
  audio: true
}).then(stream => {
  // Show my own video
  addVideoStream(stream, "Me (You)", true);

  // --- FIX START ---
  // Don't wait for "connect". Emit immediately. 
  // Socket.io handles the buffering if not connected yet.
  console.log("📸 Camera ready. Joining room...");
  socket.emit("join-room", roomId);
  // --- FIX END ---

  // 3. Handle New User Joining (We call them)
  socket.on("user-connected", userId => {
    console.log("🆕 User joined:", userId);
    // We pass our stream to the new user
    connectToNewUser(userId, stream);
  });

  // 4. Handle Signals (Incoming Calls/Answers)
  socket.on("signal", data => {
    handleSignal(data, stream);
  });

  // 5. Handle User Leaving
  socket.on("user-disconnected", userId => {
    if (peers[userId]) peers[userId].close();
    const el = document.getElementById(`wrapper-${userId}`);
    if (el) el.remove();
  });
});

// --- Core Logic (Same as before) ---

// We call the new user
async function connectToNewUser(targetId, stream) {
  const pc = createPeerConnection(targetId, stream);
  
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  console.log(`📞 Calling ${targetId}...`);
  socket.emit("signal", {
    target: targetId,
    payload: { offer }
  });
}

// Handle incoming signals
async function handleSignal(data, stream) {
  const { sender, payload } = data;
  
  if (!peers[sender]) {
    peers[sender] = createPeerConnection(sender, stream);
  }
  const pc = peers[sender];

  try {
    if (payload.offer) {
      console.log(`📩 Receiving call from ${sender}`);
      await pc.setRemoteDescription(payload.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit("signal", {
        target: sender,
        payload: { answer }
      });
    } else if (payload.answer) {
      console.log(`✅ Call answered by ${sender}`);
      await pc.setRemoteDescription(payload.answer);
    } else if (payload.candidate) {
      await pc.addIceCandidate(payload.candidate).catch(e => console.log(e));
    }
  } catch (err) {
    console.error("Signal Error:", err);
  }
}

function createPeerConnection(userId, stream) {
  const pc = new RTCPeerConnection(config);
  peers[userId] = pc;

  // THIS IS WHERE THE STREAM IS "EMITTED" TO THE PEER
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  pc.ontrack = e => {
    console.log(`📺 Track received from ${userId}`);
    if (!document.getElementById(`vid-${userId}`)) {
      addVideoStream(e.streams[0], `User ${userId.substr(0,4)}`, false, userId);
    }
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", {
        target: userId,
        payload: { candidate: e.candidate }
      });
    }
  };
  return pc;
}

function addVideoStream(stream, name, isLocal = false, userId = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "video-card";
  if (userId) wrapper.id = `wrapper-${userId}`;
  
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  
  if (isLocal) {
    video.muted = true;
    video.style.transform = "scaleX(-1)";
    wrapper.style.border = "2px solid #8ab4f8";
  } else {
    video.id = `vid-${userId}`;
    video.onloadedmetadata = () => video.play().catch(console.error);
  }
  
  const label = document.createElement("div");
  label.className = "name-tag";
  label.innerText = name;
  
  wrapper.appendChild(video);
  wrapper.appendChild(label);
  videoGrid.appendChild(wrapper);
}