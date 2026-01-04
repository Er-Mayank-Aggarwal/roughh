import { DOMHelper } from '../utils/DOMHelper.js';

export class ControlsHandler {
  constructor(mediaManager, peerManager, uiManager, socketManager, onLeave) {
    this.mediaManager = mediaManager;
    this.peerManager = peerManager;
    this.uiManager = uiManager;
    this.socketManager = socketManager;
    this.onLeave = onLeave;
    this.remoteAudioMuted = false;
    
    this._setupTrackChangeHandler();
  }

  _setupTrackChangeHandler() {
    this.mediaManager.setOnTrackChangedCallback((kind, newTrack) => {
      this.peerManager.replaceTrack(kind, newTrack);
    });
  }

  setup(previewStatus) {
    this._setupMuteButton(previewStatus.micOff);
    this._setupVideoButton(previewStatus.camOff);
    this._setupMuteOthersButton();
    this._setupLeaveButton();
    this._applyPreviewState(previewStatus);
  }

  _setupMuteButton(initialMuted) {
    const btn = DOMHelper.getElement("muteButton");
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const isMuted = await this.mediaManager.toggleAudio();
        
        if (isMuted) {
          this.peerManager.removeTrack('audio');
        }
        
        this.uiManager.updateLocalStatus("audio", isMuted);
        this.socketManager.emit("toggle-status", { type: "audio", status: isMuted });
        
        DOMHelper.toggleClass(btn, "toggled-off", isMuted);
        DOMHelper.setIcon(btn, isMuted ? "fas fa-microphone-slash" : "fas fa-microphone");
      } finally {
        btn.disabled = false;
      }
    };
  }

  _setupVideoButton(initialOff) {
    const btn = DOMHelper.getElement("disablevideoButton");
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const isVideoOff = await this.mediaManager.toggleVideo();
        
        if (isVideoOff) {
          this.peerManager.removeTrack('video');
        }
        
        this.uiManager.updateLocalStatus("video", isVideoOff);
        this.socketManager.emit("toggle-status", { type: "video", status: isVideoOff });
        
        DOMHelper.toggleClass(btn, "toggled-off", isVideoOff);
        DOMHelper.setIcon(btn, isVideoOff ? "fas fa-video-slash" : "fas fa-video");
      } finally {
        btn.disabled = false;
      }
    };
  }

  _setupMuteOthersButton() {
    const btn = DOMHelper.getElement("diableaudioButton");
    btn.onclick = () => {
      this.remoteAudioMuted = !this.remoteAudioMuted;
      this.uiManager.setRemoteVideoMuted(this.remoteAudioMuted);
      
      DOMHelper.toggleClass(btn, "toggled-off", this.remoteAudioMuted);
      DOMHelper.setIcon(btn, this.remoteAudioMuted ? "fas fa-volume-xmark" : "fas fa-volume-up");
    };
  }

  _setupLeaveButton() {
    const btn = DOMHelper.getElement("leaveButton");
    btn.onclick = () => {
      if (confirm("Are you sure you want to leave?")) {
        this.onLeave();
      }
    };
  }

  _applyPreviewState({ micOff, camOff }) {
    if (micOff) {
      const btn = DOMHelper.getElement("muteButton");
      DOMHelper.addClass(btn, "toggled-off");
      DOMHelper.setIcon(btn, "fas fa-microphone-slash");
    }
    if (camOff) {
      const btn = DOMHelper.getElement("disablevideoButton");
      DOMHelper.addClass(btn, "toggled-off");
      DOMHelper.setIcon(btn, "fas fa-video-slash");
    }
  }
}
