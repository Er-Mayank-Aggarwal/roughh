export class SignalingHandler {
  constructor(socketManager, peerManager, userManager, uiManager, mediaManager) {
    this.socketManager = socketManager;
    this.peerManager = peerManager;
    this.userManager = userManager;
    this.uiManager = uiManager;
    this.mediaManager = mediaManager;
    this.myUsername = "";
  }

  setUsername(username) {
    this.myUsername = username;
  }

  setupListeners() {
    this._handleExistingUsers();
    this._handleUserConnected();
    this._handleSignal();
    this._handleStatusUpdated();
    this._handleUserDisconnected();
  }

  _handleExistingUsers() {
    this.socketManager.on("existing-users", async (users) => {
      for (const { userId, username, status } of users) {
        this.userManager.addUser(userId, username, status);
        await this._connectToNewUser(userId);
      }
    });
  }

  _handleUserConnected() {
    this.socketManager.on("user-connected", async ({ userId, username, status }) => {
      this.userManager.addUser(userId, username, status);
      await this._connectToNewUser(userId);
    });
  }

  _handleSignal() {
    this.socketManager.on("signal", async (data) => {
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
    });
  }

  _handleStatusUpdated() {
    this.socketManager.on("user-status-updated", ({ userId, type, status }) => {
      this.userManager.updateStatus(userId, type, status);
      this.uiManager.updateUserStatus(userId, type, status);
    });
  }

  _handleUserDisconnected() {
    this.socketManager.on("user-disconnected", (userId) => {
      this.peerManager.closePeer(userId);
      this.uiManager.removeVideoElement(userId);
      this.userManager.removeUser(userId);
    });
  }

  async _connectToNewUser(targetId) {
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
}
