
const CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  mediaConstraints: {
    video: { width: 320, height: 240, frameRate: 15 },
    audio: true
  },
  meetingId: "132576",
  appName: "Study Pods 5.0"
};

class MediaManager {
  constructor() {
    this.localStream = null;
    this.audioEnabled = true;
    this.videoEnabled = true;
    this.videoElement = null;
  }

  async initializeMedia(constraints = CONFIG.mediaConstraints) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error("Failed to get media devices:", error);
      throw error;
    }
  }

  setVideoElement(element) {
    this.videoElement = element;
  }

  toggleAudio() {
    if (!this.localStream) return false;
    this.audioEnabled = !this.audioEnabled;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = this.audioEnabled;
    });
    return !this.audioEnabled;
  }

  async toggleVideo(peerManager) {
    if (!this.localStream) return false;
    this.videoEnabled = !this.videoEnabled;
    
    if (!this.videoEnabled) {
      this.localStream.getVideoTracks().forEach(track => {
        track.stop();
      });
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: CONFIG.mediaConstraints.video 
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          this.localStream.removeTrack(oldVideoTrack);
        }
        this.localStream.addTrack(newVideoTrack);
        
        if (this.videoElement) {
          this.videoElement.srcObject = this.localStream;
        }
        
        if (peerManager) {
          peerManager.replaceVideoTrack(newVideoTrack);
        }
      } catch (error) {
        console.error("Failed to re-enable video:", error);
        this.videoEnabled = false;
        return true;
      }
    }
    return !this.videoEnabled;
  }

  setAudioEnabled(enabled) {
    if (!this.localStream) return;
    this.audioEnabled = enabled;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  async setVideoEnabled(enabled, peerManager = null) {
    if (!this.localStream) return;
    this.videoEnabled = enabled;
    
    if (!enabled) {
      this.localStream.getVideoTracks().forEach(track => {
        track.stop();
      });
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: CONFIG.mediaConstraints.video 
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          this.localStream.removeTrack(oldVideoTrack);
        }
        this.localStream.addTrack(newVideoTrack);
        
        if (this.videoElement) {
          this.videoElement.srcObject = this.localStream;
        }
        
        if (peerManager) {
          peerManager.replaceVideoTrack(newVideoTrack);
        }
      } catch (error) {
        console.error("Failed to enable video:", error);
        this.videoEnabled = false;
      }
    }
  }

  getStream() {
    return this.localStream;
  }

  stopAllTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

class PeerConnectionManager {
  constructor(config, onTrack, onIceCandidate) {
    this.config = config;
    this.peers = new Map();
    this.peerStates = new Map();
    this.onTrackCallback = onTrack;
    this.onIceCandidateCallback = onIceCandidate;
    this.localSocketId = null;
  }

  setLocalSocketId(socketId) {
    this.localSocketId = socketId;
  }

  isPolite(remoteId) {
    if (!this.localSocketId) return true;
    return this.localSocketId < remoteId;
  }

  createPeerConnection(userId, stream) {
    if (this.peers.has(userId)) {
      return this.peers.get(userId);
    }

    const pc = new RTCPeerConnection(this.config);
    this.peers.set(userId, pc);
    this.peerStates.set(userId, { makingOffer: false, ignoreOffer: false });

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (event) => {
      if (this.onTrackCallback && event.streams[0]) {
        this.onTrackCallback(userId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(userId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${userId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    return pc;
  }

  getPeer(userId) {
    return this.peers.get(userId);
  }

  hasPeer(userId) {
    return this.peers.has(userId);
  }

  async createOffer(userId) {
    const pc = this.peers.get(userId);
    if (!pc) return null;
    
    const state = this.peerStates.get(userId) || { makingOffer: false, ignoreOffer: false };
    
    try {
      state.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error(`Failed to create offer for ${userId}:`, error);
      return null;
    } finally {
      state.makingOffer = false;
    }
  }

  async handleOffer(userId, offer, stream) {
    let pc = this.peers.get(userId);
    if (!pc) {
      pc = this.createPeerConnection(userId, stream);
    }

    const state = this.peerStates.get(userId) || { makingOffer: false, ignoreOffer: false };
    const polite = this.isPolite(userId);
    
    const offerCollision = state.makingOffer || pc.signalingState !== 'stable';
    state.ignoreOffer = !polite && offerCollision;
    
    if (state.ignoreOffer) {
      console.log(`Ignoring offer from ${userId} due to collision (impolite peer)`);
      return null;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error(`Failed to handle offer from ${userId}:`, error);
      return null;
    }
  }

  async handleAnswer(userId, answer) {
    const pc = this.peers.get(userId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error(`Failed to handle answer from ${userId}:`, error);
    }
  }

  async addIceCandidate(userId, candidate) {
    const pc = this.peers.get(userId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`Failed to add ICE candidate for ${userId}:`, error);
    }
  }

  updateTrackEnabled(kind, enabled) {
    this.peers.forEach((pc) => {
      const senders = pc.getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === kind) {
          sender.track.enabled = enabled;
        }
      });
    });
  }

  replaceVideoTrack(newTrack) {
    this.peers.forEach((pc, odp) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(sender => 
        sender.track?.kind === 'video' || 
        (sender.track === null && pc.getTransceivers().some(t => t.sender === sender && t.receiver.track?.kind === 'video'))
      );
      
      if (videoSender) {
        videoSender.replaceTrack(newTrack).catch(err => {
          console.error('Failed to replace track:', err);
        });
      } else {
        const transceivers = pc.getTransceivers();
        const videoTransceiver = transceivers.find(t => t.receiver.track?.kind === 'video' || t.mid === '1');
        if (videoTransceiver && videoTransceiver.sender) {
          videoTransceiver.sender.replaceTrack(newTrack).catch(err => {
            console.error('Failed to replace track via transceiver:', err);
          });
        }
      }
    });
  }

  closePeer(userId) {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
      this.peerStates.delete(userId);
    }
  }

  closeAllPeers() {
    this.peers.forEach((pc) => {
      pc.close();
    });
    this.peers.clear();
    this.peerStates.clear();
  }
}

class UserManager {
  constructor() {
    this.users = new Map(); // userId -> { username, status: { audio, video } }
  }

  addUser(userId, username, status = { audio: false, video: false }) {
    this.users.set(userId, { username, status });
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getUsername(userId) {
    const user = this.users.get(userId);
    return user ? user.username : "Guest";
  }

  updateStatus(userId, type, status) {
    const user = this.users.get(userId);
    if (user) {
      user.status[type] = status;
    }
  }

  getStatus(userId) {
    const user = this.users.get(userId);
    return user ? user.status : { audio: false, video: false };
  }

  clear() {
    this.users.clear();
  }
}

class UIManager {
  constructor(videoGridId) {
    this.videoGrid = document.getElementById(videoGridId);
    this.videoElements = new Map();
  }

  addVideoStream(stream, displayName, isLocal = false, userId = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-card";
    if (userId) {
      wrapper.id = `wrapper-${userId}`;
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    if (isLocal) {
      video.muted = true;
      video.style.transform = "scaleX(-1)";
      wrapper.style.border = "2px solid #8ab4f8";
      wrapper.dataset.local = "true";
    } else if (userId) {
      video.id = `vid-${userId}`;
      this.videoElements.set(userId, { wrapper, video });
    }

    const label = document.createElement("div");
    label.className = "name-tag";
    label.innerText = displayName;

    const statusContainer = document.createElement("div");
    statusContainer.className = "grid-status-icons";
    statusContainer.innerHTML = `
      <div class="status-badge mic-off-icon"><i class="fas fa-microphone-slash"></i></div>
      <div class="status-badge cam-off-icon"><i class="fas fa-video-slash"></i></div>
    `;

    wrapper.appendChild(video);
    wrapper.appendChild(label);
    wrapper.appendChild(statusContainer);
    this.videoGrid.appendChild(wrapper);

    return wrapper;
  }

  removeVideoElement(userId) {
    const element = document.getElementById(`wrapper-${userId}`);
    if (element) {
      element.remove();
    }
    this.videoElements.delete(userId);
  }

  hasVideoElement(userId) {
    return document.getElementById(`vid-${userId}`) !== null;
  }

  updateUserStatus(userId, type, isMuted) {
    const wrapper = document.getElementById(`wrapper-${userId}`);
    if (!wrapper) return;

    if (type === "audio") {
      wrapper.classList.toggle("is-muted", isMuted);
    } else if (type === "video") {
      wrapper.classList.toggle("is-video-off", isMuted);
    }
  }

  updateLocalStatus(type, isMuted) {
    const localWrapper = document.querySelector(".video-card[data-local='true']");
    if (!localWrapper) return;

    if (type === "audio") {
      localWrapper.classList.toggle("is-muted", isMuted);
    } else if (type === "video") {
      localWrapper.classList.toggle("is-video-off", isMuted);
    }
  }

  setInitialLocalStatus(audioMuted, videoOff) {
    const localWrapper = document.querySelector(".video-card[data-local='true']");
    if (localWrapper) {
      if (audioMuted) localWrapper.classList.add("is-muted");
      if (videoOff) localWrapper.classList.add("is-video-off");
    }
  }

  setRemoteVideoMuted(muted) {
    const remoteVideos = document.querySelectorAll(".video-card[id*='wrapper-'] video");
    remoteVideos.forEach(video => {
      video.muted = muted;
    });
  }

  updateMeetingDetails(text) {
    const detailsElement = document.querySelector(".meeting-details");
    if (detailsElement) {
      detailsElement.innerHTML = text;
    }
  }

  clearVideoGrid() {
    this.videoGrid.innerHTML = "";
    this.videoElements.clear();
  }
}

class SocketManager {
  constructor(socket) {
    this.socket = socket;
    this.eventHandlers = new Map();
  }

  emit(event, ...args) {
    this.socket.emit(event, ...args);
  }

  on(event, handler) {
    // Remove existing handler if any to prevent duplicates
    if (this.eventHandlers.has(event)) {
      this.socket.off(event, this.eventHandlers.get(event));
    }
    this.eventHandlers.set(event, handler);
    this.socket.on(event, handler);
  }

  off(event) {
    if (this.eventHandlers.has(event)) {
      this.socket.off(event, this.eventHandlers.get(event));
      this.eventHandlers.delete(event);
    }
  }

  removeAllListeners() {
    this.eventHandlers.forEach((handler, event) => {
      this.socket.off(event, handler);
    });
    this.eventHandlers.clear();
  }
}

class MeetingController {
  constructor() {
    this.socket = io();
    this.socketManager = new SocketManager(this.socket);
    this.mediaManager = new MediaManager();
    this.userManager = new UserManager();
    this.uiManager = new UIManager("video-grid");
    this.peerManager = null;
    
    this.myUsername = "";
    this.roomId = CONFIG.meetingId;
    this.remoteAudioMuted = false;
    
    // Preview state
    this.previewMicOff = false;
    this.previewCamOff = false;
    
    this.initializePeerManager();
  }

  initializePeerManager() {
    this.peerManager = new PeerConnectionManager(
      { iceServers: CONFIG.iceServers },
      this.handleRemoteTrack.bind(this),
      this.handleIceCandidate.bind(this)
    );
  }

  handleRemoteTrack(userId, stream) {
    if (!this.uiManager.hasVideoElement(userId)) {
      const username = this.userManager.getUsername(userId);
      const status = this.userManager.getStatus(userId);
      const wrapper = this.uiManager.addVideoStream(stream, username, false, userId);
      
      // Apply initial status
      if (status.audio) wrapper.classList.add("is-muted");
      if (status.video) wrapper.classList.add("is-video-off");
    }
  }

  handleIceCandidate(userId, candidate) {
    this.socketManager.emit("signal", {
      target: userId,
      payload: { candidate },
      username: this.myUsername
    });
  }

  async initializePreview() {
    const previewVideo = document.getElementById("preview-video");
    const previewOverlay = document.getElementById("preview-overlay");

    try {
      const stream = await this.mediaManager.initializeMedia();
      previewVideo.srcObject = stream;
    } catch (error) {
      previewOverlay.classList.add("show");
    }
  }

  setupPreviewControls() {
    const previewMicBtn = document.getElementById("preview-mic");
    const previewCamBtn = document.getElementById("preview-cam");
    const previewOverlay = document.getElementById("preview-overlay");
    const previewVideo = document.getElementById("preview-video");

    this.mediaManager.setVideoElement(previewVideo);

    previewMicBtn.onclick = () => {
      this.previewMicOff = !this.previewMicOff;
      previewMicBtn.classList.toggle("off", this.previewMicOff);
      previewMicBtn.querySelector("i").className = this.previewMicOff 
        ? "fas fa-microphone-slash" 
        : "fas fa-microphone";
      this.mediaManager.setAudioEnabled(!this.previewMicOff);
    };

    previewCamBtn.onclick = async () => {
      this.previewCamOff = !this.previewCamOff;
      previewCamBtn.classList.toggle("off", this.previewCamOff);
      previewCamBtn.querySelector("i").className = this.previewCamOff 
        ? "fas fa-video-slash" 
        : "fas fa-video";
      previewOverlay.classList.toggle("show", this.previewCamOff);
      await this.mediaManager.setVideoEnabled(!this.previewCamOff);
    };
  }

  setupJoinForm() {
    const usernameInput = document.getElementById("username-input");
    const joinBtn = document.getElementById("join-btn");

    usernameInput.oninput = () => {
      joinBtn.disabled = usernameInput.value.trim().length === 0;
    };

    usernameInput.onkeydown = (e) => {
      if (e.key === "Enter" && !joinBtn.disabled) {
        joinBtn.click();
      }
    };

    joinBtn.onclick = () => this.handleJoin();
  }

  async handleJoin() {
    const usernameInput = document.getElementById("username-input");
    const joinBtn = document.getElementById("join-btn");
    const joinProgress = document.getElementById("join-progress");
    const joinScreen = document.getElementById("join-screen");
    const meetingScreen = document.getElementById("meeting-screen");

    this.myUsername = usernameInput.value.trim() || "Guest";
    joinBtn.classList.add("loading");
    joinBtn.disabled = true;
    joinProgress.classList.add("show");

    this.updateProgress(1, 33);
    await this.delay(500);
    this.updateProgress(2, 66);
    await this.delay(500);
    this.updateProgress(3, 100);
    await this.delay(400);

    joinScreen.style.opacity = "0";
    joinScreen.style.transition = "opacity 0.3s";
    
    setTimeout(() => {
      joinScreen.style.display = "none";
      meetingScreen.style.display = "flex";
      this.startMeeting();
    }, 300);
  }

  updateProgress(step, percent) {
    const progressFill = document.getElementById("progress-fill");
    progressFill.style.width = percent + "%";
    
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById("step-" + i);
      el.classList.toggle("active", i <= step);
      el.classList.toggle("done", i < step);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startMeeting() {
    this.setupMeetingControls();
    this.updateMeetingTime();
    this.startTimeUpdater();
    this.applyPreviewState();
    
    const stream = this.mediaManager.getStream();
    const localWrapper = this.uiManager.addVideoStream(stream, this.myUsername + " (You)", true);
    const localVideo = localWrapper.querySelector("video");
    this.mediaManager.setVideoElement(localVideo);
    this.uiManager.setInitialLocalStatus(this.previewMicOff, this.previewCamOff);

    this.socketManager.emit("join-room", this.roomId, this.myUsername, {
      audio: this.previewMicOff,
      video: this.previewCamOff
    });

    this.setupSocketListeners();
  }

  updateMeetingTime() {
    const timeIST = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    this.uiManager.updateMeetingDetails(`${CONFIG.appName} | ${timeIST}`);
  }

  startTimeUpdater() {
    setInterval(() => this.updateMeetingTime(), 60000);
  }

  applyPreviewState() {
    if (this.previewMicOff) {
      const muteBtn = document.getElementById("muteButton");
      muteBtn.classList.add("toggled-off");
      muteBtn.querySelector("i").className = "fas fa-microphone-slash";
    }
    if (this.previewCamOff) {
      const videoBtn = document.getElementById("disablevideoButton");
      videoBtn.classList.add("toggled-off");
      videoBtn.querySelector("i").className = "fas fa-video-slash";
    }
  }

  setupMeetingControls() {
    const muteBtn = document.getElementById("muteButton");
    muteBtn.onclick = () => {
      const isMuted = this.mediaManager.toggleAudio();
      this.peerManager.updateTrackEnabled('audio', !isMuted);
      this.uiManager.updateLocalStatus("audio", isMuted);
      this.socketManager.emit("toggle-status", { type: "audio", status: isMuted });
      
      muteBtn.classList.toggle("toggled-off", isMuted);
      muteBtn.querySelector("i").className = isMuted 
        ? "fas fa-microphone-slash" 
        : "fas fa-microphone";
    };

    const videoBtn = document.getElementById("disablevideoButton");
    videoBtn.onclick = async () => {
      const isVideoOff = await this.mediaManager.toggleVideo(this.peerManager);
      this.uiManager.updateLocalStatus("video", isVideoOff);
      this.socketManager.emit("toggle-status", { type: "video", status: isVideoOff });
      
      videoBtn.classList.toggle("toggled-off", isVideoOff);
      videoBtn.querySelector("i").className = isVideoOff 
        ? "fas fa-video-slash" 
        : "fas fa-video";
    };

    const muteOthersBtn = document.getElementById("diableaudioButton");
    muteOthersBtn.onclick = () => {
      this.remoteAudioMuted = !this.remoteAudioMuted;
      this.uiManager.setRemoteVideoMuted(this.remoteAudioMuted);
      
      muteOthersBtn.classList.toggle("toggled-off", this.remoteAudioMuted);
      muteOthersBtn.querySelector("i").className = this.remoteAudioMuted 
        ? "fas fa-volume-xmark" 
        : "fas fa-volume-up";
    };

    const leaveBtn = document.getElementById("leaveButton");
    leaveBtn.onclick = () => this.leaveMeeting();
  }

  setupSocketListeners() {
    this.peerManager.setLocalSocketId(this.socket.id);

    this.socketManager.on("existing-users", async (users) => {
      for (const { userId, username, status } of users) {
        this.userManager.addUser(userId, username, status);
        await this.connectToNewUser(userId);
      }
    });

    this.socketManager.on("user-connected", async ({ userId, username, status }) => {
      this.userManager.addUser(userId, username, status);
    });

    this.socketManager.on("signal", (data) => this.handleSignal(data));

    this.socketManager.on("user-status-updated", ({ userId, type, status }) => {
      this.userManager.updateStatus(userId, type, status);
      this.uiManager.updateUserStatus(userId, type, status);
    });

    this.socketManager.on("user-disconnected", (userId) => {
      this.peerManager.closePeer(userId);
      this.uiManager.removeVideoElement(userId);
      this.userManager.removeUser(userId);
    });
  }

  async connectToNewUser(targetId) {
    const stream = this.mediaManager.getStream();
    this.peerManager.createPeerConnection(targetId, stream);
    
    const offer = await this.peerManager.createOffer(targetId);
    if (offer) {
      this.socketManager.emit("signal", {
        target: targetId,
        payload: { offer },
        username: this.myUsername
      });
    }
  }

  async handleSignal(data) {
    const { sender, username, payload } = data;
    
    if (username) {
      this.userManager.addUser(sender, username, this.userManager.getStatus(sender));
    }

    const stream = this.mediaManager.getStream();

    try {
      if (payload.offer) {
        const answer = await this.peerManager.handleOffer(sender, payload.offer, stream);
        if (answer) {
          this.socketManager.emit("signal", {
            target: sender,
            payload: { answer },
            username: this.myUsername
          });
        }
      } else if (payload.answer) {
        await this.peerManager.handleAnswer(sender, payload.answer);
      } else if (payload.candidate) {
        await this.peerManager.addIceCandidate(sender, payload.candidate);
      }
    } catch (error) {
      console.error("Signal handling error:", error);
    }
  }

  leaveMeeting() {
    const confirmLeave = confirm("Are you sure you want to leave?");
    if (!confirmLeave) return;

    this.peerManager.closeAllPeers();
    this.mediaManager.stopAllTracks();
    this.socketManager.removeAllListeners();
    this.userManager.clear();
    this.socket.disconnect();
    
    window.location = "about:blank";
  }

  async init() {
    await this.initializePreview();
    this.setupPreviewControls();
    this.setupJoinForm();
  }
}

const meetingApp = new MeetingController();
meetingApp.init();