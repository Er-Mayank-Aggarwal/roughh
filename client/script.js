
const CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Free TURN servers for restrictive networks that block UDP
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ],
  iceTransportPolicy: "all", // Try direct connection first, then relay
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  mediaConstraints: {
    video: { 
      width: { ideal: 320, max: 640 }, 
      height: { ideal: 240, max: 480 }, 
      frameRate: { ideal: 15, max: 30 },
      facingMode: "user"
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
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

  async checkPermissions() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
        const micPermission = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
        return {
          camera: cameraPermission?.state || 'prompt',
          microphone: micPermission?.state || 'prompt'
        };
      }
    } catch (e) {
      console.log('Permissions API not fully supported');
    }
    return { camera: 'prompt', microphone: 'prompt' };
  }

  async initializeMedia(constraints = CONFIG.mediaConstraints) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported. Please use HTTPS or a supported browser.');
      }

      const permissionStatus = await this.checkPermissions();
      console.log('Permission status:', permissionStatus);

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Verify audio track is present and working
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.warn('No audio track obtained, retrying audio only...');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getAudioTracks().forEach(track => this.localStream.addTrack(track));
        }
      } catch (initialError) {
        console.warn('Initial getUserMedia failed, trying fallback constraints:', initialError);
        
        const fallbackConstraints = {
          video: { facingMode: "user" },
          audio: true
        };
        
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (fallbackError) {
          console.warn('Fallback with video failed, trying audio only:', fallbackError);
          
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.videoEnabled = false;
          } catch (audioOnlyError) {
            console.error('All getUserMedia attempts failed:', audioOnlyError);
            throw audioOnlyError;
          }
        }
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          console.log(`Got ${track.kind} track:`, track.label, track.readyState);
        });
      }

      return this.localStream;
    } catch (error) {
      console.error("Failed to get media devices:", error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Camera/Microphone permission denied. Please allow access in your browser settings and reload the page.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('No camera or microphone found. Please connect a device and reload.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        alert('Camera or microphone is already in use by another application.');
      } else if (error.name === 'OverconstrainedError') {
        alert('Camera does not support the requested settings. Trying with default settings...');
      } else if (error.name === 'SecurityError') {
        alert('Media access requires HTTPS. Please use a secure connection.');
      }
      
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
      // Disable video track instead of stopping it
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      
      // Update peers with disabled track
      if (peerManager) {
        peerManager.updateTrackEnabled('video', false);
      }
    } else {
      // Check if we have a live video track
      const existingVideoTrack = this.localStream.getVideoTracks()[0];
      
      if (existingVideoTrack && existingVideoTrack.readyState === 'live') {
        // Just re-enable the existing track
        existingVideoTrack.enabled = true;
        if (peerManager) {
          peerManager.updateTrackEnabled('video', true);
        }
        console.log('Re-enabled existing video track');
      } else {
        // Need to get a new video track
        console.log('Getting new video track...');
      try {
        let newStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({ 
            video: CONFIG.mediaConstraints.video 
          });
        } catch (e) {
          console.warn('Failed with ideal constraints, trying fallback:', e);
          newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
          });
        }
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
      // Don't stop the track, just disable it to maintain peer connection
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      if (peerManager) {
        peerManager.updateTrackEnabled('video', false);
      }
    } else {
      // Check if we have a live video track
      const existingVideoTrack = this.localStream.getVideoTracks()[0];
      
      if (existingVideoTrack && existingVideoTrack.readyState === 'live') {
        // Just re-enable the existing track
        existingVideoTrack.enabled = true;
        if (peerManager) {
          peerManager.updateTrackEnabled('video', true);
        }
        console.log('Re-enabled existing video track in setVideoEnabled');
      } else {
        // Need to get a new video track
        console.log('Getting new video track in setVideoEnabled...');
      try {
        let newStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({ 
            video: CONFIG.mediaConstraints.video 
          });
        } catch (e) {
          console.warn('Failed with ideal constraints, trying fallback:', e);
          newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
          });
        }
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
  }

  getStream() {
    return this.localStream;
  }

  setupDeviceChangeListener(peerManager, onDeviceChange) {
    if (!navigator.mediaDevices) return;

    navigator.mediaDevices.ondevicechange = async () => {
      console.log('Device change detected');
      
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        console.log('Available devices:', { video: videoDevices.length, audio: audioDevices.length });

        if (this.localStream) {
          const currentVideoTrack = this.localStream.getVideoTracks()[0];
          const currentAudioTrack = this.localStream.getAudioTracks()[0];

          if (currentVideoTrack && currentVideoTrack.readyState === 'ended') {
            console.log('Video track ended, attempting to get new video device');
            if (videoDevices.length > 0 && this.videoEnabled) {
              await this.recoverVideoTrack(peerManager);
              if (onDeviceChange) onDeviceChange('video', 'recovered');
            } else {
              this.videoEnabled = false;
              if (onDeviceChange) onDeviceChange('video', 'lost');
            }
          }

          if (currentAudioTrack && currentAudioTrack.readyState === 'ended') {
            console.log('Audio track ended, attempting to get new audio device');
            if (audioDevices.length > 0 && this.audioEnabled) {
              await this.recoverAudioTrack(peerManager);
              if (onDeviceChange) onDeviceChange('audio', 'recovered');
            } else {
              this.audioEnabled = false;
              if (onDeviceChange) onDeviceChange('audio', 'lost');
            }
          }
        }
      } catch (error) {
        console.error('Error handling device change:', error);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.onended = async () => {
          console.log(`${track.kind} track ended unexpectedly`);
          if (track.kind === 'video' && this.videoEnabled) {
            await this.recoverVideoTrack(peerManager);
            if (onDeviceChange) onDeviceChange('video', 'recovered');
          } else if (track.kind === 'audio' && this.audioEnabled) {
            await this.recoverAudioTrack(peerManager);
            if (onDeviceChange) onDeviceChange('audio', 'recovered');
          }
        };
      });
    }
  }

  async recoverVideoTrack(peerManager) {
    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ 
          video: CONFIG.mediaConstraints.video 
        });
      } catch (e) {
        newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" } 
        });
      }
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        throw new Error('No video track in new stream');
      }

      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        this.localStream.removeTrack(oldVideoTrack);
      }
      this.localStream.addTrack(newVideoTrack);

      newVideoTrack.onended = async () => {
        console.log('Recovered video track ended');
        if (this.videoEnabled) {
          await this.recoverVideoTrack(peerManager);
        }
      };

      if (this.videoElement) {
        this.videoElement.srcObject = this.localStream;
      }

      if (peerManager) {
        peerManager.replaceVideoTrack(newVideoTrack);
      }

      console.log('Video track recovered successfully');
      return true;
    } catch (error) {
      console.error('Failed to recover video track:', error);
      this.videoEnabled = false;
      return false;
    }
  }

  async recoverAudioTrack(peerManager) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        audio: CONFIG.mediaConstraints.audio || true 
      });
      
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) {
        throw new Error('No audio track in new stream');
      }

      // Preserve the current enabled state
      newAudioTrack.enabled = this.audioEnabled;

      const oldAudioTrack = this.localStream.getAudioTracks()[0];
      if (oldAudioTrack) {
        oldAudioTrack.stop();
        this.localStream.removeTrack(oldAudioTrack);
      }
      this.localStream.addTrack(newAudioTrack);

      newAudioTrack.onended = async () => {
        console.log('Recovered audio track ended');
        if (this.audioEnabled) {
          await this.recoverAudioTrack(peerManager);
        }
      };

      if (peerManager) {
        await peerManager.replaceAudioTrack(newAudioTrack);
      }

      console.log('Audio track recovered successfully');
      return true;
    } catch (error) {
      console.error('Failed to recover audio track:', error);
      this.audioEnabled = false;
      return false;
    }
  }

  stopAllTracks() {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      this.localStream = null;
    }
  }
}

class PeerConnectionManager {
  constructor(config, onTrack, onIceCandidate) {
    this.config = config;
    this.peers = new Map();
    this.peerStates = new Map();
    this.iceCandidateBuffer = new Map(); // Buffer candidates until remote description is set
    this.onTrackCallback = onTrack;
    this.onIceCandidateCallback = onIceCandidate;
    this.localSocketId = null;
    this.connectionTimeouts = new Map(); // Track connection timeouts for recovery
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
    this.peerStates.set(userId, { 
      makingOffer: false, 
      ignoreOffer: false, 
      iceRestarts: 0, 
      maxIceRestarts: 3 
    });
    this.iceCandidateBuffer.set(userId, []); // Initialize candidate buffer

    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track (enabled: ${track.enabled}) for peer ${userId}`);
        try {
          const sender = pc.addTrack(track, stream);
          console.log(`Track added successfully, sender:`, sender);
        } catch (err) {
          console.error(`Failed to add ${track.kind} track:`, err);
        }
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
      
      if (pc.connectionState === 'connected') {
        // Clear timeout when connected
        if (this.connectionTimeouts.has(userId)) {
          clearTimeout(this.connectionTimeouts.get(userId));
          this.connectionTimeouts.delete(userId);
        }
      } else if (pc.connectionState === 'failed') {
        const state = this.peerStates.get(userId);
        if (state && state.iceRestarts < state.maxIceRestarts) {
          state.iceRestarts++;
          console.log(`ICE restart attempt ${state.iceRestarts}/${state.maxIceRestarts} for peer ${userId}`);
          pc.restartIce();
        } else {
          console.error(`Max ICE restart attempts reached for peer ${userId}`);
        }
      } else if (pc.connectionState === 'disconnected') {
        // Set timeout to attempt recovery after 30s of disconnection
        if (!this.connectionTimeouts.has(userId)) {
          const timeout = setTimeout(() => {
            console.warn(`Peer ${userId} disconnected for 30s, attempting ICE restart`);
            if (pc.connectionState === 'disconnected') {
              pc.restartIce();
            }
          }, 30000);
          this.connectionTimeouts.set(userId, timeout);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`Peer ${userId} ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        const state = this.peerStates.get(userId);
        if (state && state.iceRestarts < state.maxIceRestarts) {
          state.iceRestarts++;
          pc.restartIce();
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`Peer ${userId} ICE gathering state: ${pc.iceGatheringState}`);
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
      // Flush buffered ICE candidates now that remote description is set
      await this.flushIceCandidates(userId);
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
      // Flush buffered ICE candidates now that remote description is set
      await this.flushIceCandidates(userId);
    } catch (error) {
      console.error(`Failed to handle answer from ${userId}:`, error);
    }
  }

  async addIceCandidate(userId, candidate) {
    const pc = this.peers.get(userId);
    if (!pc) return;

    try {
      // If remote description not yet set, buffer the candidate for later
      if (pc.remoteDescription === null) {
        console.log(`Buffering ICE candidate for ${userId} (remote description not yet set)`);
        const buffer = this.iceCandidateBuffer.get(userId) || [];
        buffer.push(candidate);
        this.iceCandidateBuffer.set(userId, buffer);
        return;
      }
      
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      // Ignore "known error" for duplicate or late candidates
      if (error.name === 'OperationError') {
        console.warn(`ICE candidate error for ${userId}: ${error.message}`);
      } else {
        console.error(`Failed to add ICE candidate for ${userId}:`, error);
      }
    }
  }

  async flushIceCandidates(userId) {
    const pc = this.peers.get(userId);
    if (!pc) return;
    
    const buffer = this.iceCandidateBuffer.get(userId) || [];
    if (buffer.length === 0) return;
    
    console.log(`Flushing ${buffer.length} buffered ICE candidates for ${userId}`);
    
    for (const candidate of buffer) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(`Failed to add buffered ICE candidate for ${userId}:`, error.message);
      }
    }
    
    this.iceCandidateBuffer.set(userId, []);
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

  async replaceAudioTrack(newTrack) {
    const promises = [];
    
    this.peers.forEach((pc, userId) => {
      const senders = pc.getSenders();
      const audioSender = senders.find(sender => 
        sender.track?.kind === 'audio' || 
        (sender.track === null && pc.getTransceivers().some(t => t.sender === sender && t.receiver.track?.kind === 'audio'))
      );
      
      if (audioSender) {
        promises.push(
          audioSender.replaceTrack(newTrack)
            .then(() => console.log(`Audio track replaced for peer ${userId}`))
            .catch(err => console.error(`Failed to replace audio track for peer ${userId}:`, err))
        );
      } else {
        const transceivers = pc.getTransceivers();
        const audioTransceiver = transceivers.find(t => t.receiver.track?.kind === 'audio' || t.mid === '0');
        if (audioTransceiver && audioTransceiver.sender) {
          promises.push(
            audioTransceiver.sender.replaceTrack(newTrack)
              .then(() => console.log(`Audio track replaced via transceiver for peer ${userId}`))
              .catch(err => console.error(`Failed to replace audio track via transceiver for peer ${userId}:`, err))
          );
        } else {
          console.warn(`No audio sender found for peer ${userId}, attempting to add track`);
          try {
            pc.addTrack(newTrack);
          } catch (err) {
            console.error(`Failed to add audio track for peer ${userId}:`, err);
          }
        }
      }
    });
    
    await Promise.all(promises);
  }

  closePeer(userId) {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
      this.peerStates.delete(userId);
      this.iceCandidateBuffer.delete(userId);
      
      // Clear any pending timeout
      if (this.connectionTimeouts.has(userId)) {
        clearTimeout(this.connectionTimeouts.get(userId));
        this.connectionTimeouts.delete(userId);
      }
    }
  }

  closeAllPeers() {
    this.peers.forEach((pc) => {
      pc.close();
    });
    this.peers.clear();
    this.peerStates.clear();
    this.iceCandidateBuffer.clear();
    
    // Clear all pending timeouts
    this.connectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.connectionTimeouts.clear();
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
      video.muted = false;  // Explicitly unmute remote audio
      video.volume = 1.0;   // Set volume to max
      this.videoElements.set(userId, { wrapper, video });
      
      // Ensure audio plays even with autoplay restrictions
      video.play().catch(err => {
        console.warn('Auto-play prevented for remote video:', err);
        // Retry play on user interaction
        const playOnInteraction = () => {
          video.play().catch(e => console.error('Play failed:', e));
          document.removeEventListener('click', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction, { once: true });
      });
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
      console.log(`Setting remote video muted to ${muted} for`, video.id);
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
    console.log(`Received remote track from ${userId}, audio tracks: ${stream.getAudioTracks().length}, video tracks: ${stream.getVideoTracks().length}`);
    
    // Log audio track details
    stream.getAudioTracks().forEach(track => {
      console.log(`Remote audio track - enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
    });
    
    if (!this.uiManager.hasVideoElement(userId)) {
      const username = this.userManager.getUsername(userId);
      const status = this.userManager.getStatus(userId);
      const wrapper = this.uiManager.addVideoStream(stream, username, false, userId);
      
      // Apply initial status
      if (status.audio) wrapper.classList.add("is-muted");
      if (status.video) wrapper.classList.add("is-video-off");
    } else {
      // Update existing video element with new stream
      const videoEl = document.getElementById(`vid-${userId}`);
      if (videoEl && videoEl.srcObject !== stream) {
        console.log(`Updating stream for existing video element ${userId}`);
        videoEl.srcObject = stream;
        videoEl.play().catch(e => console.error('Failed to play updated stream:', e));
      }
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
    const joinBtn = document.getElementById("join-btn");

    try {
      const stream = await this.mediaManager.initializeMedia();
      previewVideo.srcObject = stream;
      
      previewVideo.onloadedmetadata = () => {
        previewVideo.play().catch(e => {
          console.warn('Auto-play prevented:', e);
        });
      };
      
      if (!this.mediaManager.videoEnabled) {
        previewOverlay.classList.add("show");
        this.previewCamOff = true;
        const previewCamBtn = document.getElementById("preview-cam");
        if (previewCamBtn) {
          previewCamBtn.classList.add("off");
          previewCamBtn.querySelector("i").className = "fas fa-video-slash";
        }
      }
    } catch (error) {
      console.error('Preview initialization failed:', error);
      previewOverlay.classList.add("show");
      this.previewCamOff = true;
      this.previewMicOff = true;
      
      const previewCamBtn = document.getElementById("preview-cam");
      const previewMicBtn = document.getElementById("preview-mic");
      if (previewCamBtn) {
        previewCamBtn.classList.add("off");
        previewCamBtn.querySelector("i").className = "fas fa-video-slash";
      }
      if (previewMicBtn) {
        previewMicBtn.classList.add("off");
        previewMicBtn.querySelector("i").className = "fas fa-microphone-slash";
      }
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

    this.mediaManager.setupDeviceChangeListener(this.peerManager, (type, status) => {
      console.log(`Device ${type} ${status}`);
      if (status === 'lost') {
        if (type === 'video') {
          this.uiManager.updateLocalStatus('video', true);
          const videoBtn = document.getElementById("disablevideoButton");
          videoBtn.classList.add("toggled-off");
          videoBtn.querySelector("i").className = "fas fa-video-slash";
        } else if (type === 'audio') {
          this.uiManager.updateLocalStatus('audio', true);
          const muteBtn = document.getElementById("muteButton");
          muteBtn.classList.add("toggled-off");
          muteBtn.querySelector("i").className = "fas fa-microphone-slash";
        }
      } else if (status === 'recovered') {
        if (type === 'video') {
          this.uiManager.updateLocalStatus('video', false);
          const videoBtn = document.getElementById("disablevideoButton");
          videoBtn.classList.remove("toggled-off");
          videoBtn.querySelector("i").className = "fas fa-video";
        }
      }
    });

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
    
    // Log current stream state
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    console.log(`Connecting to ${targetId} with:`, {
      audio: audioTracks.length > 0 ? `enabled=${audioTracks[0].enabled}` : 'none',
      video: videoTracks.length > 0 ? `enabled=${videoTracks[0].enabled}` : 'none'
    });
    
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
    
    // Log stream state when handling signals
    if (payload.offer || payload.answer) {
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      console.log(`Handling ${payload.offer ? 'offer' : 'answer'} from ${sender} with local stream:`, {
        audio: audioTracks.length > 0 ? `enabled=${audioTracks[0].enabled}` : 'none',
        video: videoTracks.length > 0 ? `enabled=${videoTracks[0].enabled}` : 'none'
      });
    }

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
    const overlay = document.getElementById("leave-popup-overlay");
    overlay.classList.add("show");

    document.getElementById("leave-cancel").onclick = () => {
      overlay.classList.remove("show");
    };

    document.getElementById("leave-confirm").onclick = () => {
      this.peerManager.closeAllPeers();
      this.mediaManager.stopAllTracks();
      this.socketManager.removeAllListeners();
      this.userManager.clear();
      this.socket.disconnect();
      window.location = "about:blank";
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("show");
      }
    };
  }

  async init() {
    await this.initializePreview();
    this.setupPreviewControls();
    this.setupJoinForm();
  }
}

const meetingApp = new MeetingController();
meetingApp.init();