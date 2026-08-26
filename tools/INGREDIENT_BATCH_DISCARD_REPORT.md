# Ingredient Batch and Discard Workflow Report

Date: 2026-08-25

## Implemented

- Added `ingredient_batches` with lot number, received/remaining quantity, purchase date, expiry date, supplier, unit cost, notes, and creator.
- Added `discard_requests` with Pending/Approved/Rejected state and requester/approver/rejection timestamps and users.
- Extended `waste_log` with batch, request, unit, requester, approver, approval time, and discard time fields.
- Extended ingredient movements with optional previous/new stock snapshots.
- Added idempotent legacy-batch backfill so existing ingredient stock remains traceable without changing aggregate stock.
- Added `staff/api_ingredient_batches.php` for batch listing and authorized batch stock-in.
- Added `staff/api_discard_requests.php` for staff requests and manager/admin/owner approval or rejection.
- Added owner to the existing inventory read/manager role allowlists.
- Updated Ingredients UI with Add Stock fields, batch history, expiry statuses, discard request form, pending-approval labels, and owner approval actions.

## Live Verification

- React app compiled successfully through the dev server at `http://localhost:3001`.
- Unauthenticated `/staff` access redirected to `/staff/login`.
- Ingredients page loaded 9 real database ingredients.
- Add Stock modal rendered with ingredient, quantity, lot, purchase/expiry, supplier, unit cost, and notes fields.
- History displayed migrated `LEGACY-1` batch and Expired status.
- Discard request submission succeeded and changed the row to Pending Approval without reducing stock.
- Admin approval succeeded and produced the expected stock reduction and waste record.
- API confirmed the approved waste row contained All-purpose Flour, quantity 35, Raw Material, Expired.
- The live test transaction was reverted afterward; migration/backfilled batches remain.
- Mobile screenshot at 390x844 confirmed the page renders and the table is horizontally scrollable.
- Modified-file diagnostics are clean.

## Remaining Limitations

- Existing pre-batch movement rows cannot receive historical previous/new stock snapshots retroactively.
- Approval actions are currently exposed in the shared Ingredients page for manager/admin/owner roles; a dedicated approval queue route was not introduced.
- Waste Analytics already reads approved waste rows, but dedicated batch/month/approval columns are not yet surfaced as separate analytics cards.
- The project still reports the existing Tailwind CDN production warning.
