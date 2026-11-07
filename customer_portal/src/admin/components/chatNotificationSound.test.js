import { playAdminChatMessageSound, unlockAdminChatMessageSound } from "./chatNotificationSound";

describe("admin chat message audio playback", () => {
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

  test("unlocks audio after user interaction and plays the chat message sound", async () => {
    await unlockAdminChatMessageSound();
    playAdminChatMessageSound();

    expect(playMock).toHaveBeenCalledTimes(2);
    expect(pauseMock).toHaveBeenCalledTimes(2);
  });
});
