import notificationSoundUrl from "../../admin/components/confirmation-tone.wav";
import chatMessageSoundUrl from "../../admin/components/message.mp3";

let notificationAudio = null;
let chatAudio = null;
const unlockedSounds = new WeakSet();
let unlockPromise = null;

function getAudio(type) {
  if (typeof Audio === "undefined") return null;

  if (type === "notification") {
    notificationAudio = notificationAudio || new Audio(notificationSoundUrl);
    notificationAudio.preload = "auto";
    return notificationAudio;
  }

  chatAudio = chatAudio || new Audio(chatMessageSoundUrl);
  chatAudio.preload = "auto";
  return chatAudio;
}

export function getNewUnreadCustomerNotifications(notifications, seenIds) {
  return notifications.filter((notification) => (
    !notification.read && !seenIds.has(String(notification.id))
  ));
}

export function getNewIncomingCustomerMessages(messages, seenIds) {
  return messages.filter((message) => (
    message.id != null &&
    ["admin", "staff", "ai"].includes(String(message.sender).toLowerCase()) &&
    !seenIds.has(String(message.id))
  ));
}

export function unlockCustomerNotificationSounds() {
  if (unlockPromise) return unlockPromise;

  const sounds = [getAudio("notification"), getAudio("chat")]
    .filter((sound) => sound && !unlockedSounds.has(sound));
  if (!sounds.length) return Promise.resolve();

  unlockPromise = Promise.all(sounds.map((sound) => {
    sound.muted = true;
    return sound.play()
      .then(() => {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
        unlockedSounds.add(sound);
      })
      .catch((error) => {
        sound.muted = false;
        console.warn("Unable to enable a customer notification sound:", error);
      });
  }))
    .finally(() => {
      unlockPromise = null;
    });

  return unlockPromise;
}

function playSound(type) {
  const sound = getAudio(type);
  if (!sound || !unlockedSounds.has(sound)) return;

  try {
    sound.pause();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      console.warn(`Unable to play the customer ${type} sound:`, error);
    });
  } catch (error) {
    console.warn(`Unable to play the customer ${type} sound:`, error);
  }
}

export function playCustomerNotificationSound() {
  playSound("notification");
}

export function playCustomerChatMessageSound() {
  playSound("chat");
}
