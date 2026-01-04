import { DOMHelper } from '../utils/DOMHelper.js';

export class PreviewHandler {
  constructor(mediaManager) {
    this.mediaManager = mediaManager;
    this.micOff = false;
    this.camOff = false;
    this._bindElements();
  }

  _bindElements() {
    this.previewVideo = DOMHelper.getElement("preview-video");
    this.previewOverlay = DOMHelper.getElement("preview-overlay");
    this.previewMicBtn = DOMHelper.getElement("preview-mic");
    this.previewCamBtn = DOMHelper.getElement("preview-cam");
  }

  async initialize() {
    try {
      const stream = await this.mediaManager.initializeMedia();
      this.previewVideo.srcObject = stream;
    } catch (error) {
      DOMHelper.addClass(this.previewOverlay, "show");
    }
  }

  setupControls() {
    this.previewMicBtn.onclick = () => this._toggleMic();
    this.previewCamBtn.onclick = () => this._toggleCam();
  }

  _toggleMic() {
    this.micOff = !this.micOff;
    DOMHelper.toggleClass(this.previewMicBtn, "off", this.micOff);
    DOMHelper.setIcon(this.previewMicBtn, 
      this.micOff ? "fas fa-microphone-slash" : "fas fa-microphone");
    this.mediaManager.setAudioEnabled(!this.micOff);
  }

  _toggleCam() {
    this.camOff = !this.camOff;
    DOMHelper.toggleClass(this.previewCamBtn, "off", this.camOff);
    DOMHelper.setIcon(this.previewCamBtn,
      this.camOff ? "fas fa-video-slash" : "fas fa-video");
    DOMHelper.toggleClass(this.previewOverlay, "show", this.camOff);
    this.mediaManager.setVideoEnabled(!this.camOff);
  }

  stopDisabledTracks() {
    if (this.micOff) {
      this.mediaManager.stopTracks('audio');
    }
    if (this.camOff) {
      this.mediaManager.stopTracks('video');
    }
  }

  getStatus() {
    return { micOff: this.micOff, camOff: this.camOff };
  }
}
