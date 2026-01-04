import { DOMHelper } from '../utils/DOMHelper.js';

export class JoinHandler {
  constructor(onJoinCallback) {
    this.onJoinCallback = onJoinCallback;
    this._bindElements();
  }

  _bindElements() {
    this.usernameInput = DOMHelper.getElement("username-input");
    this.joinBtn = DOMHelper.getElement("join-btn");
    this.joinProgress = DOMHelper.getElement("join-progress");
    this.progressFill = DOMHelper.getElement("progress-fill");
    this.joinScreen = DOMHelper.getElement("join-screen");
    this.meetingScreen = DOMHelper.getElement("meeting-screen");
  }

  setupForm() {
    this.usernameInput.oninput = () => {
      this.joinBtn.disabled = this.usernameInput.value.trim().length === 0;
    };

    this.usernameInput.onkeydown = (e) => {
      if (e.key === "Enter" && !this.joinBtn.disabled) {
        this.joinBtn.click();
      }
    };

    this.joinBtn.onclick = () => this._handleJoin();
  }

  async _handleJoin() {
    const username = this.usernameInput.value.trim() || "Guest";
    
    DOMHelper.addClass(this.joinBtn, "loading");
    this.joinBtn.disabled = true;
    DOMHelper.addClass(this.joinProgress, "show");

    await this._animateProgress();
    await this._transitionToMeeting();
    
    this.onJoinCallback(username);
  }

  async _animateProgress() {
    this._updateProgress(1, 33);
    await DOMHelper.delay(500);
    this._updateProgress(2, 66);
    await DOMHelper.delay(500);
    this._updateProgress(3, 100);
    await DOMHelper.delay(400);
  }

  _updateProgress(step, percent) {
    this.progressFill.style.width = percent + "%";
    for (let i = 1; i <= 3; i++) {
      const el = DOMHelper.getElement("step-" + i);
      DOMHelper.toggleClass(el, "active", i <= step);
      DOMHelper.toggleClass(el, "done", i < step);
    }
  }

  async _transitionToMeeting() {
    this.joinScreen.style.opacity = "0";
    this.joinScreen.style.transition = "opacity 0.3s";
    await DOMHelper.delay(300);
    this.joinScreen.style.display = "none";
    this.meetingScreen.style.display = "flex";
  }
}
