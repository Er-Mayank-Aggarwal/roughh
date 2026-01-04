import { CONFIG } from '../config.js';

export class MediaManager {
  constructor() {
    this.localStream = null;
    this.audioEnabled = true;
    this.videoEnabled = true;
    this.onTrackChangedCallback = null;
  }

  setOnTrackChangedCallback(callback) {
    this.onTrackChangedCallback = callback;
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

  async toggleAudio() {
    if (!this.localStream) return false;
    this.audioEnabled = !this.audioEnabled;
    
    if (!this.audioEnabled) {
      this._stopTracks('audio');
    } else {
      await this._restartTracks('audio');
    }
    
    return !this.audioEnabled;
  }

  async toggleVideo() {
    if (!this.localStream) return false;
    this.videoEnabled = !this.videoEnabled;
    
    if (!this.videoEnabled) {
      this._stopTracks('video');
    } else {
      await this._restartTracks('video');
    }
    
    return !this.videoEnabled;
  }

  setAudioEnabled(enabled) {
    this.audioEnabled = enabled;
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(track => track.enabled = enabled);
  }

  setVideoEnabled(enabled) {
    this.videoEnabled = enabled;
    if (!this.localStream) return;
    this.localStream.getVideoTracks().forEach(track => track.enabled = enabled);
  }

  _stopTracks(kind) {
    if (!this.localStream) return;
    const tracks = kind === 'audio' 
      ? this.localStream.getAudioTracks() 
      : this.localStream.getVideoTracks();
    tracks.forEach(track => {
      track.stop();
      this.localStream.removeTrack(track);
    });
  }

  async _restartTracks(kind) {
    try {
      const constraints = kind === 'audio' 
        ? { audio: CONFIG.mediaConstraints.audio }
        : { video: CONFIG.mediaConstraints.video };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === 'audio' 
        ? newStream.getAudioTracks()[0]
        : newStream.getVideoTracks()[0];
      
      if (newTrack) {
        this.localStream.addTrack(newTrack);
        this.onTrackChangedCallback?.(kind, newTrack);
      }
    } catch (error) {
      console.error(`Failed to restart ${kind}:`, error);
      if (kind === 'audio') this.audioEnabled = false;
      else this.videoEnabled = false;
    }
  }

  getStream() {
    return this.localStream;
  }

  stopTracks(kind) {
    this._stopTracks(kind);
  }

  stopAllTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}
