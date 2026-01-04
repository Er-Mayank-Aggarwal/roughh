import { CONFIG } from '../config.js';
import { MediaManager } from '../managers/MediaManager.js';
import { PeerConnectionManager } from '../managers/PeerConnectionManager.js';
import { UserManager } from '../managers/UserManager.js';
import { UIManager } from '../managers/UIManager.js';
import { SocketManager } from '../managers/SocketManager.js';
import { PreviewHandler } from '../handlers/PreviewHandler.js';
import { JoinHandler } from '../handlers/JoinHandler.js';
import { ControlsHandler } from '../handlers/ControlsHandler.js';
import { SignalingHandler } from '../handlers/SignalingHandler.js';
import { TimeHelper } from '../utils/TimeHelper.js';

export class MeetingController {
  constructor() {
    this._initializeManagers();
    this._initializeHandlers();
    this._setupPeerCallbacks();
    
    this.myUsername = "";
    this.roomId = CONFIG.meetingId;
    this.timeUpdateInterval = null;
  }

  _initializeManagers() {
    this.socket = io();
    this.socketManager = new SocketManager(this.socket);
    this.mediaManager = new MediaManager();
    this.userManager = new UserManager();
    this.uiManager = new UIManager("video-grid");
    this.peerManager = new PeerConnectionManager({ iceServers: CONFIG.iceServers });
  }

  _initializeHandlers() {
    this.previewHandler = new PreviewHandler(this.mediaManager);
    this.joinHandler = new JoinHandler((username) => this._startMeeting(username));
    this.signalingHandler = new SignalingHandler(
      this.socketManager,
      this.peerManager,
      this.userManager,
      this.uiManager,
      this.mediaManager
    );
  }

  _setupPeerCallbacks() {
    this.peerManager.setOnTrackCallback((userId, stream) => {
      if (!this.uiManager.hasVideoElement(userId)) {
        const username = this.userManager.getUsername(userId);
        const status = this.userManager.getStatus(userId);
        const wrapper = this.uiManager.addVideoStream(stream, username, false, userId);
        if (status.audio) wrapper.classList.add("is-muted");
        if (status.video) wrapper.classList.add("is-video-off");
      }
    });

    this.peerManager.setOnIceCandidateCallback((userId, candidate) => {
      this.socketManager.emit("signal", {
        target: userId,
        payload: { candidate },
        username: this.myUsername
      });
    });
  }

  async init() {
    try {
      await this.previewHandler.initialize();
      this.previewHandler.setupControls();
      this.joinHandler.setupForm();
    } catch (error) {
      console.error("Failed to initialize meeting:", error);
      this.joinHandler.setupForm();
    }
  }

  _startMeeting(username) {
    this.myUsername = username;
    this.signalingHandler.setUsername(username);
    
    const previewStatus = this.previewHandler.getStatus();
    this.previewHandler.stopDisabledTracks();
    
    this.controlsHandler = new ControlsHandler(
      this.mediaManager,
      this.peerManager,
      this.uiManager,
      this.socketManager,
      () => this._leaveMeeting()
    );
    this.controlsHandler.setup(previewStatus);
    
    this._setupMeetingUI(previewStatus);
    this._joinRoom(previewStatus);
    this.signalingHandler.setupListeners();
  }

  _setupMeetingUI(previewStatus) {
    this.uiManager.updateMeetingDetails(TimeHelper.getMeetingTitle());
    this._startTimeUpdater();
    
    const stream = this.mediaManager.getStream();
    this.uiManager.addVideoStream(stream, this.myUsername + " (You)", true);
    this.uiManager.setInitialLocalStatus(previewStatus.micOff, previewStatus.camOff);
  }

  _joinRoom(previewStatus) {
    this.socketManager.emit("join-room", this.roomId, this.myUsername, {
      audio: previewStatus.micOff,
      video: previewStatus.camOff
    });
  }

  _startTimeUpdater() {
    this.timeUpdateInterval = setInterval(() => {
      this.uiManager.updateMeetingDetails(TimeHelper.getMeetingTitle());
    }, CONFIG.timeUpdateInterval);
  }

  _leaveMeeting() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    this.peerManager.closeAllPeers();
    this.mediaManager.stopAllTracks();
    this.socketManager.removeAllListeners();
    this.userManager.clear();
    this.socketManager.disconnect();
    window.location = "about:blank";
  }
}
