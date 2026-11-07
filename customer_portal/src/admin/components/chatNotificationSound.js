import chatNotificationSoundUrl from "./message.mp3";

let audio = null;

function getAudio() {
  if (typeof Audio === "undefined") return null;
  audio = audio || new Audio(chatNotificationSoundUrl);
  audio.preload = "auto";
  return audio;
}

export function unlockAdminChatMessageSound() {
  const sound = getAudio();
  if (!sound) return;

  sound.muted = true;
  sound.play()
    .then(() => {
      sound.pause();
      sound.currentTime = 0;
      sound.muted = false;
    })
    .catch((error) => {
      sound.muted = false;
      console.warn("Unable to enable the admin chat message sound:", error);
    });
}

export function playAdminChatMessageSound() {
  const sound = getAudio();
  if (!sound) return;

  sound.currentTime = 0;
  sound.play().catch((error) => {
    console.warn("Unable to play the admin chat message sound:", error);
  });
}
