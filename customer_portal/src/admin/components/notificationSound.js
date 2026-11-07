import notificationSoundUrl from "./confirmation-tone.wav";

const SOUND_PREFERENCE_KEY = "adminNotificationSoundEnabled";

let audio = null;
let audioUnlocked = false;

function getAudio() {
  if (typeof Audio === "undefined") return null;
  audio = audio || new Audio(notificationSoundUrl);
  audio.preload = "auto";
  return audio;
}

export function getNotificationSoundEnabled() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function unlockNotificationSound() {
  const sound = getAudio();
  if (!sound) return Promise.resolve();

  sound.muted = true;
  return sound.play()
    .then(() => {
      sound.pause();
      sound.currentTime = 0;
      sound.muted = false;
      audioUnlocked = true;
    })
    .catch((error) => {
      sound.muted = false;
      console.warn("Unable to enable the admin notification sound:", error);
    });
}

export function setNotificationSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

export function getNewUnreadNotifications(notifications, seenIds) {
  return notifications.filter((notification) => (
    !notification.is_read && !seenIds.has(String(notification.id))
  ));
}

export function playNotificationSound() {
  const sound = getAudio();
  if (!sound || !audioUnlocked) return;

  try {
    sound.pause();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      console.warn("Unable to play the admin notification sound:", error);
    });
  } catch (error) {
    console.warn("Unable to play the admin notification sound:", error);
  }
}
