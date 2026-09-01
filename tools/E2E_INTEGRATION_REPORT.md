# Pastry Ordering and Inventory E2E Integration Report

Date: 2026-08-25
Environment: XAMPP Apache/PHP/MySQL, `pastry_db`

## Execution Summary

The existing HTTP integration suite was previously executed against the local application and produced **57 PASS, 0 FAIL**. Its captured output is in `tools/test_out.txt`.

A fresh rerun was attempted during this pass with `C:\xampp\php\php.exe`. The run was blocked before setup because MySQL was unavailable, first refusing the connection and then reporting `MySQL server has gone away`. No application code was changed, and no fixture data was created by the blocked rerun.

## Test Results

| Module | Scenario | Expected | Actual | Status |
|---|---|---|---|---|
| Authentication | Logged-out staff API request | 401 | 401 in captured integration run | PASS |
| Authentication | Customer token on staff write/read API | 403 | 403 in captured integration run | PASS |
| Production | Valid production transaction | Product increases; recipe ingredients decrease; production and movements recorded | 3 units produced; product +3; ingredient -6; audit rows present | PASS |
| Production | Invalid, missing-recipe, unknown-product, insufficient-stock requests | Rejected with no partial changes | Rejected and rollback checks passed | PASS |
| Production | Duplicate and concurrent production | Apply once per request/key; no lost updates | Idempotency and concurrent row-lock checks passed | PASS |
| Stock adjustment | Stock in/out and invalid quantities | Correct stock and audit trail | Passed, including excessive stock-out rejection | PASS |
| Orders | Confirm order | Stock decreases exactly once and movement is recorded | Passed in captured integration run | PASS |
| Waste | Valid and invalid waste | Stock, waste row, and movement update atomically | Passed, including insufficient stock and idempotency | PASS |
| Cancellation | Cancel fulfilled/confirmed order twice | Restore once only | Passed, including repeated cancellation and re-confirmation | PASS |
| Analytics | Analytics endpoint authorization and response | Staff can read; customer denied | Staff 200 and customer 403 | PASS |
| Analytics | Completed sale revenue/product analytics | Completed transaction reflected | Not asserted by the existing suite | NEEDS REVIEW |
| Recommendations | Demand/production/low-stock/waste recommendations | New data changes recommendations when enough history exists | Not exercised by the existing suite | NEEDS REVIEW |
| Refresh | Refresh, navigate away, return, compare displayed stock | UI equals database | Not exercised | NEEDS REVIEW |
| Multi-user | Production/order/waste/adjustment combinations | Transactions preserve correct totals | Only concurrent production and confirmation were exercised | NEEDS REVIEW |
| Failure handling | DB failure, timeout, invalid IDs, expired session | Clear error; no fake movement | Some invalid/auth cases passed; DB/timeout/expired-session cases not exercised | NEEDS REVIEW |
| Responsive UX | Desktop, laptop, tablet, small screen | All important actions remain accessible | Not exercised with browser/device automation | NEEDS REVIEW |
| Console/API quality | Console errors, warnings, duplicate requests, loading/empty states | No regressions | Not exercised with browser automation | NEEDS REVIEW |

## Verified Flow Invariants

The captured integration run verified these database invariants through the staff/customer APIs:

- Production locks the product and recipe ingredients, deducts ingredient stock, adds finished stock, writes ingredient movements, writes a production row, and writes a finished-product movement in one transaction.
- Invalid production requests roll back without production or movement rows.
- Product stock-out rejects insufficient stock instead of clamping to zero.
- Waste locks the target row, rejects insufficient stock, updates stock, writes the waste row, and writes the movement atomically.
- Order confirmation deducts stock once, even after status flip-flops and concurrent confirmation requests.
- Cancellation restores stock once and repeated cancellation is idempotent.
- Customer cancellation is ownership-scoped; staff bearer tokens are rejected by the customer cancellation endpoint.
- Legacy order status injection/status-bypass attempts are rejected.
- Product and ingredient history endpoints return audit fields and movements.

## Bugs Discovered

1. **Environment blocker:** MySQL was not reliably running during the fresh pass. This prevented a current end-to-end rerun and database snapshot.
2. **Coverage gap:** The existing suite confirms analytics endpoint access but does not complete an order and assert revenue, completed-order count, product sales, waste analytics, production analytics, or product-performance values.
3. **Coverage gap:** Recommendations, browser refresh persistence, responsive layouts, browser console errors, and timeout behavior are not covered by the existing PHP suite.

No additional application defect was safely isolated because the fresh run could not reach the database.

## Bugs Fixed

None in this pass. Existing application behavior was not changed.

## Files Modified

- `tools/E2E_INTEGRATION_REPORT.md` added.

## Database Changes

None. The fresh run was blocked before fixture setup. The previously captured suite cleans up its temporary `TEST Cake`, `TEST Flour`, `itstaff@example.com`, and `itcust@example.com` fixtures.

## API Changes

None.

## Final Inventory-Flow Verification

The verified captured run supports the core invariant:

`staff action -> authenticated API -> validated transaction -> stock update -> movement/audit record`

The full requested invariant through analytics and recommendations is **NEEDS REVIEW** until MySQL is stable and the completed-order, recommendation, browser refresh, responsive, and failure scenarios are executed. Do not mark the overall pass as complete based only on the 57-check suite.

## Next Execution Gate

1. Start and confirm XAMPP MySQL remains listening on port 3306.
2. Run `C:\xampp\php\php.exe tools\inventory_integrity_test.php`.
3. Execute the real-product scenario for Chocolate Ganache Cake, including 10 production units, 2 completed sales, 1 waste entry, and cancellation.
4. Assert the balance equation and analytics/recommendation values from the database and API response.
5. Run browser checks for refresh persistence, responsive access, console errors, loading states, and empty states.
