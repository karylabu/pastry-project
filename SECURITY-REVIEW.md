# Server-Side Role Authorization Review

**Review date:** 2026-10-24  
**Scope:** Laravel API routes and legacy PHP endpoints, focused on server-side authorization for the `admin` and `customer` roles.

## Findings

### 1. Unsupported roles are accepted by shared authorization helpers

- **Severity:** Medium
- **Confidence:** 8/10
- **Location:** `laravel/app/Http/Controllers/Controller.php:80,94`
- **Evidence:** The shared authorization helpers permit `staff` and `manager`, even though the supported role model is only `admin` and `customer`. API routes use these helpers for inventory batches, waste, and discard approval/rejection. A valid token carrying one of these role values can therefore reach operations outside the defined role model.
- **Recommendation:** Restrict the shared helpers to the supported roles and ensure privileged operations are admin-only.

### 2. Admin web authorization trusts a cached session role

- **Severity:** Medium
- **Confidence:** 9/10
- **Location:** `laravel/app/Http/Controllers/AdminController.php:13-20,181-192`; `laravel/app/Http/Controllers/CustomerApiController.php:760`; `laravel/routes/web.php:55`
- **Evidence:** The web authorization check relies on the user stored in the PHP session and does not re-check the account's current role or active status. If an administrator is deactivated or demoted while a session remains active, that session may continue to access admin routes, including order-status updates. The user-status endpoint updates the database but does not invalidate that session.
- **Recommendation:** Revalidate the current role and active status on protected requests, and invalidate active sessions when an account is deactivated or demoted.

### 3. Public product maintenance endpoint has no role authorization

- **Severity:** Medium
- **Confidence:** 9/10
- **Location:** `customer/fix_products_db.php:16-18,162-183`; `.htaccess:12`
- **Evidence:** The directly reachable PHP maintenance script can update and insert product data and set available product stock to 50 without authentication or a role check. The root rewrite configuration serves customer PHP endpoints directly, so the request does not have to pass through Laravel authorization. Other exposed maintenance scripts also modify or delete product records.
- **Recommendation:** Remove maintenance scripts from the public document root or require a server-side admin authorization check before any database mutation.

## Controls verified during this review

- Laravel and legacy order-waste recording endpoints require the `admin` role.
- Customer cancellation requires authentication and is limited to the customer's own pending order.
- Legacy order-status and stock-update endpoints require an authenticated admin.
- Promotion-management and stock APIs use admin authorization.
- User management, sales import, admin settings/alerts, analytics, and staff API handlers were found to contain admin checks.

These controls do not resolve the findings above; the identified authorization gaps should be fixed separately.
