import chatNotificationSoundUrl from "./message.mp3";

let audio = null;
let audioUnlocked = false;

function getAudio() {
  if (typeof Audio === "undefined") return null;
  audio = audio || new Audio(chatNotificationSoundUrl);
  audio.preload = "auto";
  return audio;
}

export function unlockAdminChatMessageSound() {
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
      console.warn("Unable to enable the admin chat message sound:", error);
    });
}

export function playAdminChatMessageSound() {
  const sound = getAudio();
  if (!sound || !audioUnlocked) return;

  try {
    sound.pause();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      console.warn("Unable to play the admin chat message sound:", error);
    });
  } catch (error) {
    console.warn("Unable to play the admin chat message sound:", error);
  }
}
