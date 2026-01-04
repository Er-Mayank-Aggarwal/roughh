import { CONFIG } from '../config.js';

export class TimeHelper {
  static getFormattedTime() {
    return new Date().toLocaleTimeString("en-IN", {
      timeZone: CONFIG.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }

  static getMeetingTitle() {
    return `${CONFIG.appName} | ${this.getFormattedTime()}`;
  }
}
