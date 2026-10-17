const originalFetch = window.fetch;

describe("pastryLoaderGate", () => {
  const apiUrl = "http://localhost/GitHub/pastry-project/laravel/public/api/customer/products";

  beforeEach(() => {
    jest.resetModules();
    delete window.__plGate;
    window.PastryLoader = { task: jest.fn(() => window.__plTaskDone) };
    window.__plTaskDone = jest.fn();
    window.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    delete window.__plGate;
    delete window.PastryLoader;
    delete window.__plTaskDone;
  });

  it("tracks API requests and settles the task after the response", async () => {
    require("./pastryLoaderGate");

    await window.fetch(apiUrl);

    expect(window.PastryLoader.task).toHaveBeenCalledTimes(1);
    expect(window.__plTaskDone).toHaveBeenCalledTimes(1);
  });

  it("does not track non-API assets", async () => {
    require("./pastryLoaderGate");

    await window.fetch("http://localhost/uploads/logo.png");

    expect(window.PastryLoader.task).not.toHaveBeenCalled();
    expect(window.__plTaskDone).not.toHaveBeenCalled();
  });

  it("settles the task when an API request fails", async () => {
    window.fetch.mockRejectedValueOnce(new Error("network error"));
    require("./pastryLoaderGate");

    await expect(window.fetch(apiUrl)).rejects.toThrow("network error");

    expect(window.PastryLoader.task).toHaveBeenCalledTimes(1);
    expect(window.__plTaskDone).toHaveBeenCalledTimes(1);
  });

  it("does not wrap fetch more than once after hot reload", async () => {
    require("./pastryLoaderGate");
    const wrappedFetch = window.fetch;
    jest.resetModules();
    require("./pastryLoaderGate");

    await window.fetch(apiUrl);

    expect(window.fetch).toBe(wrappedFetch);
    expect(window.PastryLoader.task).toHaveBeenCalledTimes(1);
  });
});
