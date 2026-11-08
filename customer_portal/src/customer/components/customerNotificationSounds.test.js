import {
  getNewIncomingCustomerMessages,
  getNewUnreadCustomerNotifications,
  playCustomerChatMessageSound,
  playCustomerNotificationSound,
  unlockCustomerNotificationSounds,
} from "./customerNotificationSounds";

describe("customer notification sounds", () => {
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

  test("finds unseen unread notifications", () => {
    expect(getNewUnreadCustomerNotifications([
      { id: 1, read: false },
      { id: 2, read: true },
      { id: 3, read: false },
    ], new Set(["1"]))).toEqual([{ id: 3, read: false }]);
  });

  test("finds unseen incoming messages, excluding customer messages", () => {
    expect(getNewIncomingCustomerMessages([
      { id: 1, sender: "customer" },
      { id: 2, sender: "admin" },
      { id: 3, sender: "staff" },
    ], new Set(["2"]))).toEqual([{ id: 3, sender: "staff" }]);
  });

  test("unlocks and plays notification and chat sounds", async () => {
    await unlockCustomerNotificationSounds();
    playCustomerNotificationSound();
    playCustomerChatMessageSound();

    expect(playMock).toHaveBeenCalledTimes(4);
    expect(pauseMock).toHaveBeenCalledTimes(4);
  });

  test("chat sound still works if the separate notification sound cannot unlock", async () => {
    let sounds;
    const warnMock = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.isolateModules(() => {
      sounds = require("./customerNotificationSounds");
    });
    playMock
      .mockRejectedValueOnce(new Error("Notification audio unavailable"))
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();

    await sounds.unlockCustomerNotificationSounds();
    sounds.playCustomerChatMessageSound();

    expect(playMock).toHaveBeenCalledTimes(3);
    warnMock.mockRestore();
  });

  test("retries the chat sound after it was blocked before user interaction", async () => {
    let sounds;
    const warnMock = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.isolateModules(() => {
      sounds = require("./customerNotificationSounds");
    });
    playMock
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("Chat audio blocked"))
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();

    sounds.playCustomerChatMessageSound();
    await sounds.unlockCustomerNotificationSounds();
    expect(playMock).toHaveBeenCalledTimes(2);

    await sounds.unlockCustomerNotificationSounds();

    expect(playMock).toHaveBeenCalledTimes(4);
    warnMock.mockRestore();
  });
});
