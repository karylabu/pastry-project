import notificationSoundUrl from "./confirmation-tone.wav";

const SOUND_PREFERENCE_KEY = "adminNotificationSoundEnabled";

let audioContext = null;
let notificationSoundBuffer = null;
let notificationSoundBufferPromise = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  audioContext = audioContext || new AudioContextClass();
  return audioContext;
}

function getNotificationSoundBuffer(context) {
  if (notificationSoundBuffer) return Promise.resolve(notificationSoundBuffer);
  if (notificationSoundBufferPromise) return notificationSoundBufferPromise;

  notificationSoundBufferPromise = fetch(notificationSoundUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load the notification sound file.");
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      notificationSoundBuffer = buffer;
      return buffer;
    })
    .catch((error) => {
      notificationSoundBufferPromise = null;
      throw error;
    });

  return notificationSoundBufferPromise;
}

export function getNotificationSoundEnabled() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export async function unlockNotificationSound() {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    await getNotificationSoundBuffer(context);
  } catch (error) {
    console.error("Unable to enable the admin notification sound.", error);
  }
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

export async function playNotificationSound() {
  try {
    const context = getAudioContext();
    if (!context) return;

    if (context.state !== "running") return;
    const source = context.createBufferSource();
    source.buffer = await getNotificationSoundBuffer(context);
    source.connect(context.destination);
    source.start();
  } catch (error) {
    console.error("Unable to play the admin notification sound.", error);
  }
}
