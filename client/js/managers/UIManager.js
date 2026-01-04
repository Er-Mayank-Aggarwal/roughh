export class UIManager {
  constructor(videoGridId) {
    this.videoGrid = document.getElementById(videoGridId);
    this.videoElements = new Map();
    this.localVideoElement = null;
  }

  addVideoStream(stream, displayName, isLocal = false, userId = null) {
    const wrapper = this._createVideoWrapper(userId, isLocal);
    const video = this._createVideoElement(stream, isLocal, userId);
    const label = this._createNameTag(displayName);

    wrapper.appendChild(video);
    wrapper.appendChild(label);
    this.videoGrid.appendChild(wrapper);

    if (isLocal) {
      this.localVideoElement = video;
    } else if (userId) {
      this.videoElements.set(userId, { wrapper, video });
    }

    return wrapper;
  }

  updateLocalStream(stream) {
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = stream;
    }
  }

  _createVideoWrapper(userId, isLocal) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-card";
    if (userId) wrapper.id = `wrapper-${userId}`;
    if (isLocal) {
      wrapper.style.border = "2px solid #8ab4f8";
      wrapper.dataset.local = "true";
    }
    return wrapper;
  }

  _createVideoElement(stream, isLocal, userId) {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    if (isLocal) {
      video.muted = true;
      video.style.transform = "scaleX(-1)";
    } else if (userId) {
      video.id = `vid-${userId}`;
    }
    return video;
  }

  _createNameTag(displayName) {
    const label = document.createElement("div");
    label.className = "name-tag";
    label.innerText = displayName;
    return label;
  }

  removeVideoElement(userId) {
    document.getElementById(`wrapper-${userId}`)?.remove();
    this.videoElements.delete(userId);
  }

  hasVideoElement(userId) {
    return document.getElementById(`vid-${userId}`) !== null;
  }

  updateUserStatus(userId, type, isMuted) {
    const wrapper = document.getElementById(`wrapper-${userId}`);
    if (!wrapper) return;
    this._toggleStatusClass(wrapper, type, isMuted);
  }

  updateLocalStatus(type, isMuted) {
    const localWrapper = document.querySelector(".video-card[data-local='true']");
    if (localWrapper) {
      this._toggleStatusClass(localWrapper, type, isMuted);
    }
  }

  _toggleStatusClass(element, type, isMuted) {
    const className = type === "audio" ? "is-muted" : "is-video-off";
    element.classList.toggle(className, isMuted);
  }

  setInitialLocalStatus(audioMuted, videoOff) {
    const localWrapper = document.querySelector(".video-card[data-local='true']");
    if (localWrapper) {
      if (audioMuted) localWrapper.classList.add("is-muted");
      if (videoOff) localWrapper.classList.add("is-video-off");
    }
  }

  setRemoteVideoMuted(muted) {
    document.querySelectorAll(".video-card[id*='wrapper-'] video")
      .forEach(video => video.muted = muted);
  }

  updateMeetingDetails(text) {
    const el = document.querySelector(".meeting-details");
    if (el) el.innerHTML = text;
  }

  clearVideoGrid() {
    this.videoGrid.innerHTML = "";
    this.videoElements.clear();
    this.localVideoElement = null;
  }
}
