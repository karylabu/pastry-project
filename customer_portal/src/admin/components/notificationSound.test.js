import {
  getNewUnreadNotifications,
  playNotificationSound,
  unlockNotificationSound,
} from "./notificationSound";

describe("getNewUnreadNotifications", () => {
  test("returns only unread notifications that have not been seen", () => {
    const notifications = [
      { id: 1, is_read: false },
      { id: 2, is_read: true },
      { id: 3, is_read: false },
    ];

    expect(getNewUnreadNotifications(notifications, new Set(["1"]))).toEqual([
      { id: 3, is_read: false },
    ]);
  });
});

describe("notification audio playback", () => {
  let playMock;
  let pauseMock;

  beforeEach(() => {
    playMock = jest.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue();
    pauseMock = jest.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    playMock.mockRestore();
    pauseMock.mockRestore();
  });

  test("unlocks audio after user interaction and plays the notification sound", async () => {
    await unlockNotificationSound();
    playNotificationSound();

    expect(playMock).toHaveBeenCalledTimes(2);
    expect(pauseMock).toHaveBeenCalledTimes(2);
  });
});
