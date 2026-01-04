const socket = io();
const videoGrid = document.getElementById("video-grid");
const peers = {};
const usernames = {};
const userStatus = {};
let myUsername = "";
let localStream = null;
let previewMicOff = false;
let previewCamOff = false;
const joinScreen = document.getElementById("join-screen");
const meetingScreen = document.getElementById("meeting-screen");
const previewVideo = document.getElementById("preview-video");
const previewOverlay = document.getElementById("preview-overlay");
const previewMicBtn = document.getElementById("preview-mic");
const previewCamBtn = document.getElementById("preview-cam");
const usernameInput = document.getElementById("username-input");
const joinBtn = document.getElementById("join-btn");
const joinProgress = document.getElementById("join-progress");
const progressFill = document.getElementById("progress-fill");
navigator.mediaDevices.getUserMedia({
  video: { width: 320, height: 240, frameRate: 15 },
  audio: true
}).then(stream => {
  localStream = stream;
  previewVideo.srcObject = stream;
}).catch(() => {
  previewOverlay.classList.add("show");
});
previewMicBtn.onclick = () => {
  previewMicOff = !previewMicOff;
  previewMicBtn.classList.toggle("off", previewMicOff);
  previewMicBtn.querySelector("i").className = previewMicOff ? "fas fa-microphone-slash" : "fas fa-microphone";
  if (localStream) {
    localStream.getAudioTracks().forEach(track => track.enabled = !previewMicOff);
  }
};
previewCamBtn.onclick = () => {
  previewCamOff = !previewCamOff;
  previewCamBtn.classList.toggle("off", previewCamOff);
  previewCamBtn.querySelector("i").className = previewCamOff ? "fas fa-video-slash" : "fas fa-video";
  previewOverlay.classList.toggle("show", previewCamOff);
  if (localStream) {
    localStream.getVideoTracks().forEach(track => track.enabled = !previewCamOff);
  }
};
usernameInput.oninput = () => {
  joinBtn.disabled = usernameInput.value.trim().length === 0;
};
usernameInput.onkeydown = (e) => {
  if (e.key === "Enter" && !joinBtn.disabled) joinBtn.click();
};
function updateProgress(step, percent) {
  progressFill.style.width = percent + "%";
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById("step-" + i);
    el.classList.toggle("active", i <= step);
    el.classList.toggle("done", i < step);
  }
}
joinBtn.onclick = async () => {
  myUsername = usernameInput.value.trim() || "Guest";
  joinBtn.classList.add("loading");
  joinBtn.disabled = true;
  joinProgress.classList.add("show");
  updateProgress(1, 33);
  await new Promise(r => setTimeout(r, 500));
  updateProgress(2, 66);
  await new Promise(r => setTimeout(r, 500));
  updateProgress(3, 100);
  await new Promise(r => setTimeout(r, 400));
  joinScreen.style.opacity = "0";
  joinScreen.style.transition = "opacity 0.3s";
  setTimeout(() => {
    joinScreen.style.display = "none";
    meetingScreen.style.display = "flex";
    startMeeting();
  }, 300);
};
function startMeeting() {
  setupMeetingControls();
  const timeIST = new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const meetID = "132576";
  const roomId = "Study Pods 5.0" + " | " + timeIST;
  document.querySelector(".meeting-details").innerHTML = roomId;
  setInterval(() => {
    const timeIST = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    const roomId = "Study Pods 5.0" + " | " + timeIST;
    document.querySelector(".meeting-details").innerHTML = roomId;
  }, 60000);
  if (previewMicOff) {
    document.getElementById("muteButton").classList.add("toggled-off");
    document.getElementById("muteButton").querySelector("i").className = "fas fa-microphone-slash";
  }
  if (previewCamOff) {
    document.getElementById("disablevideoButton").classList.add("toggled-off");
    document.getElementById("disablevideoButton").querySelector("i").className = "fas fa-video-slash";
  }
  addVideoStream(localStream, myUsername + " (You)", true);
  socket.emit("join-room", meetID, myUsername, { audio: previewMicOff, video: previewCamOff });
  socket.on("existing-users", (users) => {
    users.forEach(({ userId, username, status }) => {
      usernames[userId] = username;
      if (status) {
        userStatus[userId] = status;
      }
    });
  });
  socket.on("user-connected", ({ userId, username, status }) => {
    usernames[userId] = username;
    if (status) {
      userStatus[userId] = status;
    }
    connectToNewUser(userId, localStream);
  });
  socket.on("signal", data => {
    handleSignal(data, localStream);
  });
  socket.on("user-status-updated", ({ userId, type, status }) => {
    const remoteWrapper = document.getElementById(`wrapper-${userId}`);
    if (remoteWrapper) {
      if (type === "audio") {
        remoteWrapper.classList.toggle("is-muted", status);
      } else if (type === "video") {
        remoteWrapper.classList.toggle("is-video-off", status);
      }
    }
  });
  socket.on("user-disconnected", userId => {
    if (peers[userId]) peers[userId].close();
    const el = document.getElementById(`wrapper-${userId}`);
    if (el) el.remove();
  });
}
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
let isMuted = false;
let isVideoDisabled = false;
let disableaudio = false;
function setupMeetingControls() {
  isMuted = previewMicOff;
  isVideoDisabled = previewCamOff;
  const btn = document.getElementById("muteButton");
  btn.onclick = () => {
    isMuted = !isMuted;
    for (let peerId in peers) {
      const senders = peers[peerId].getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = !isMuted;
        }
      });
    }
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
    const localWrapper = document.querySelector(".video-card:not([id*='wrapper-'])");
    if (localWrapper) localWrapper.classList.toggle("is-muted", isMuted);
    socket.emit("toggle-status", { type: "audio", status: isMuted });
  };
  const disvideoBtn = document.getElementById("disablevideoButton");
  disvideoBtn.onclick = () => {
    isVideoDisabled = !isVideoDisabled;
    for (let peerId in peers) {
      const senders = peers[peerId].getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
          sender.track.enabled = !isVideoDisabled;
        }
      });
    }
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !isVideoDisabled);
    }
    const localWrapper = document.querySelector(".video-card:not([id*='wrapper-'])");
    if (localWrapper) localWrapper.classList.toggle("is-video-off", isVideoDisabled);
    socket.emit("toggle-status", { type: "video", status: isVideoDisabled });
  };
  const disableAudioBtn = document.getElementById("diableaudioButton");
  disableAudioBtn.onclick = () => {
    disableaudio = !disableaudio;
    const users = document.querySelectorAll(".video-card");
    Array.from(users).filter(user => user.id.includes("wrapper")).forEach(user => {
      const video = user.querySelector("video");
      video.muted = disableaudio;
    });
  };
  const lvbutton = document.getElementById("leaveButton");
  lvbutton.onclick = () => {
    for (let peerId in peers) {
      peers[peerId].close();
    }
    socket.emit("disconnect1");
    let leaving = confirm("Tusi sachi jare ho??");
    if (!leaving) return;
    window.location = "about:blank";
  };
}
socket.on("user-status-updated", ({ userId, type, status }) => {
  const video = document.getElementById(`wrapper-${userId}`);
  if (!video) return;
  if (type === "audio" && !status) {
    video.classList.add("is-muted");
  } else if (type === "audio" && status) {
    video.classList.remove("is-muted");
  }
  if (type === "video" && !status) {
    video.classList.add("is-video-off");
  } else if (type === "video" && status) {
    video.classList.remove("is-video-off");
  }
});
async function connectToNewUser(targetId, stream) {
  const pc = createPeerConnection(targetId, stream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("signal", { target: targetId, payload: { offer }, username: myUsername });
}
async function handleSignal(data, stream) {
  const { sender, username, payload } = data;
  if (username) usernames[sender] = username;
  if (!peers[sender]) peers[sender] = createPeerConnection(sender, stream);
  const pc = peers[sender];
  try {
    if (payload.offer) {
      await pc.setRemoteDescription(payload.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { target: sender, payload: { answer }, username: myUsername });
    } else if (payload.answer) {
      await pc.setRemoteDescription(payload.answer);
    } else if (payload.candidate) {
      await pc.addIceCandidate(payload.candidate);
    }
  } catch (err) {}
}
function createPeerConnection(userId, stream) {
  const pc = new RTCPeerConnection(config);
  peers[userId] = pc;
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  pc.ontrack = e => {
    if (!document.getElementById(`vid-${userId}`)) {
      addVideoStream(e.streams[0], usernames[userId] || "Guest", false, userId);
    }
  };
  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { target: userId, payload: { candidate: e.candidate }, username: myUsername });
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
    if (previewCamOff) wrapper.classList.add("is-video-off");
    if (previewMicOff) wrapper.classList.add("is-muted");
  } else {
    video.id = `vid-${userId}`;
    if (userStatus[userId]) {
      if (userStatus[userId].audio) wrapper.classList.add("is-muted");
      if (userStatus[userId].video) wrapper.classList.add("is-video-off");
    }
  }
  const label = document.createElement("div");
  label.className = "name-tag";
  label.innerText = name;
  wrapper.appendChild(video);
  wrapper.appendChild(label);
  videoGrid.appendChild(wrapper);
}