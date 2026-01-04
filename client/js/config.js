export const CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  mediaConstraints: {
    video: { width: 320, height: 240, frameRate: 15 },
    audio: true
  },
  meetingId: "132576",
  appName: "Study Pods 5.0",
  timeZone: "Asia/Kolkata",
  timeUpdateInterval: 60000
};
