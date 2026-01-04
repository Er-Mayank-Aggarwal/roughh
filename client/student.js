const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const pc = new RTCPeerConnection(config);
let teacherId = null;

// 1. Monitor Connection State (Debugs Network Issues)
pc.onconnectionstatechange = () => {
  console.log("📶 Connection State:", pc.connectionState);
  if (pc.connectionState === "failed") {
    alert("Connection failed! Please refresh.");
  }
};

async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, frameRate: 15 },
      audio: true
    });

    document.getElementById("localVideo").srcObject = stream;
    
    // Add tracks carefully
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
      console.log(`📤 Sending track: ${track.kind}`);
    });

    socket.emit("join", "student");
    console.log("✅ Ready. Joined as student.");

  } catch (err) {
    console.error("Camera Error:", err);
    alert("Camera blocked! Use HTTPS or localhost.");
  }
}

start();

socket.on("teacher-id", id => {
  teacherId = id;
});

// 2. Robust Video Handling
pc.ontrack = e => {
  console.log("📥 Track received:", e.track.kind);
  
  // Only handle video tracks for the main display
  if (e.track.kind === 'video') {
    const video = document.getElementById("remoteVideo");
    video.srcObject = e.streams[0];
    
    // FORCE VIDEO TO WAKE UP
    video.onloadedmetadata = () => {
      console.log(`🎬 Video Metadata Loaded: ${video.videoWidth}x${video.videoHeight}`);
      if (video.videoWidth === 0) {
        console.warn("⚠️ Video has 0 dimensions (Black Screen Issue)");
      }
      video.play().catch(console.error);
    };
  }
  
  // Audio handling
  if (e.track.kind === 'audio') {
    const video = document.getElementById("remoteVideo");
    // Ensure audio plays
    video.muted = false; 
    video.play().catch(e => {
        console.log("Autoplay blocked, showing button");
        document.getElementById("startAudio").style.display = "block";
    });
  }
};

document.getElementById("startAudio").onclick = () => {
  const v = document.getElementById("remoteVideo");
  v.muted = false;
  v.play();
  document.getElementById("startAudio").style.display = "none";
};

pc.onicecandidate = e => {
  if (e.candidate && teacherId) {
    socket.emit("ice", { target: teacherId, candidate: e.candidate });
  }
};

socket.on("offer", async payload => {
  const offer = payload.offer || payload;
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { target: teacherId, answer });
});

socket.on("signal", candidate => {
  pc.addIceCandidate(candidate).catch(e => {});
});