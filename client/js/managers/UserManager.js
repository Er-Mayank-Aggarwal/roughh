export class UserManager {
  constructor() {
    this.users = new Map();
  }

  addUser(userId, username, status = { audio: false, video: false }) {
    this.users.set(userId, { username, status: { ...status } });
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getUsername(userId) {
    return this.users.get(userId)?.username || "Guest";
  }

  updateStatus(userId, type, status) {
    const user = this.users.get(userId);
    if (user?.status) {
      user.status[type] = status;
    }
  }

  getStatus(userId) {
    return this.users.get(userId)?.status || { audio: false, video: false };
  }

  clear() {
    this.users.clear();
  }
}
