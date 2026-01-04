const socket = io();

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const pc = new RTCPeerConnection(config);
let teacherId = null;
let answered = false;

// 1. Start Media with Low Latency Constraints
async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 }, // Low resolution for speed
        height: { ideal: 240 },
        frameRate: { ideal: 15, max: 20 } // Low FPS to reduce packet queue
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Show local self-view
    const localVid = document.getElementById("localVideo");
    localVid.srcObject = stream;
    
    // Add tracks to connection
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Join only after media is ready
    socket.emit("join", "student");
    console.log("📸 Local media ready (Low Latency Mode)");

  } catch (err) {
    console.error("Error accessing media:", err);
    alert("Camera access is required for class!");
  }
}

start();

socket.on("teacher-id", id => {
  teacherId = id;
});

// 2. Handle Teacher Video (Optimized for Latency)
pc.ontrack = e => {
  console.log("✅ Teacher track received");
  const video = document.getElementById("remoteVideo");
  const btn = document.getElementById("startAudio");

  if (video.srcObject !== e.streams[0]) {
    video.srcObject = e.streams[0];
    
    // FORCE PLAY: Don't wait for buffer to fill
    video.onloadedmetadata = () => {
      video.play().catch(e => console.log("Autoplay blocked waiting for click"));
    };
  }

  btn.onclick = () => {
    video.muted = false;
    video.play();
    btn.style.display = "none";
  };
};

pc.onicecandidate = e => {
  if (e.candidate && teacherId) {
    socket.emit("ice", { target: teacherId, candidate: e.candidate });
  }
};

socket.on("offer", async offer => {
  if (answered) return;
  answered = true;
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer });
});

socket.on("ice", candidate => {
  pc.addIceCandidate(candidate).catch(e => console.error(e));
});