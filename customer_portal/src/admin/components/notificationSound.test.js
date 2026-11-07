import { getNewUnreadNotifications } from "./notificationSound";

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
