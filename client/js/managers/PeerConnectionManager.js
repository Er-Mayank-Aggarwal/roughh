export class PeerConnectionManager {
  constructor(config) {
    this.config = config;
    this.peers = new Map();
    this.onTrackCallback = null;
    this.onIceCandidateCallback = null;
  }

  setOnTrackCallback(callback) {
    this.onTrackCallback = callback;
  }

  setOnIceCandidateCallback(callback) {
    this.onIceCandidateCallback = callback;
  }

  createPeerConnection(userId, stream) {
    if (this.peers.has(userId)) {
      return this.peers.get(userId);
    }

    const pc = new RTCPeerConnection(this.config);
    this.peers.set(userId, pc);

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      this.onTrackCallback?.(userId, event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback?.(userId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${userId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeer(userId);
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
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error(`Failed to create offer for ${userId}:`, error);
      return null;
    }
  }

  async handleOffer(userId, offer, stream) {
    let pc = this.peers.get(userId);
    if (!pc) {
      pc = this.createPeerConnection(userId, stream);
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
      pc.getSenders().forEach(sender => {
        if (sender.track?.kind === kind) {
          sender.track.enabled = enabled;
        }
      });
    });
  }

  replaceTrack(kind, newTrack) {
    this.peers.forEach((pc) => {
      pc.getSenders().forEach(sender => {
        const senderKind = sender.track?.kind || (sender.kind === kind ? kind : null);
        if (senderKind === kind) {
          sender.replaceTrack(newTrack).catch(err => {
            console.error(`Failed to replace ${kind} track:`, err);
          });
        }
      });
    });
  }

  removeTrack(kind) {
    this.peers.forEach((pc) => {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === kind) {
          sender.track.stop();
          sender.replaceTrack(null).catch(err => {
            console.error(`Failed to remove ${kind} track:`, err);
          });
        }
      });
    });
  }

  closePeer(userId) {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
    }
  }

  closeAllPeers() {
    this.peers.forEach(pc => pc.close());
    this.peers.clear();
  }
}
