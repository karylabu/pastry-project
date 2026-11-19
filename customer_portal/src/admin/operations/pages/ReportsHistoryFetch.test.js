import { fetchAllReportHistory } from "./Reports";

test("retries a temporary history-page failure without changing row order", async () => {
  let pageTwoAttempts = 0;
  const fetchPage = jest.fn(async (page) => {
    if (page === 2 && pageTwoAttempts++ === 0) {
      const error = new Error("Temporary server error");
      error.status = 503;
      throw error;
    }

    return {
      sales: [{ page }],
      pagination: { last_page: 3 },
    };
  });

  await expect(fetchAllReportHistory(fetchPage)).resolves.toEqual([
    { page: 1 },
    { page: 2 },
    { page: 3 },
  ]);
  expect(fetchPage).toHaveBeenCalledTimes(4);
});

test("accepts a complete history response in a single page", async () => {
  const sales = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const fetchPage = jest.fn().mockResolvedValue({
    sales,
    pagination: { last_page: 1 },
  });

  await expect(fetchAllReportHistory(fetchPage)).resolves.toEqual(sales);
  expect(fetchPage).toHaveBeenCalledTimes(1);
});
