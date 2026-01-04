export class SocketManager {
  constructor(socket) {
    this.socket = socket;
    this.eventHandlers = new Map();
    this._setupConnectionHandlers();
  }

  _setupConnectionHandlers() {
    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        this.socket.connect();
      }
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  emit(event, ...args) {
    if (this.socket.connected) {
      this.socket.emit(event, ...args);
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
    }
  }

  on(event, handler) {
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

  disconnect() {
    this.socket.disconnect();
  }
}
