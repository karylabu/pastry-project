# Pastry Project system architecture

## Overview

Pastry Project is a responsive web application with two role-based user
experiences:

1. Customer web application for browsing products, submitting orders and
   customized cake requests, payments, chat, and order tracking.
2. Admin web application for order operations, products, ingredients, waste,
   sales reports, analytics, forecasting, and customer communication.

## Logical architecture

```text
Customer browser ─────┐
                      ├── React customer/admin frontend
Admin browser ────────┘
                              │ HTTPS/JSON and SSE
                              ▼
                    Laravel and legacy PHP API layer
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
     Order services     Inventory services   Analytics services
          │                   │                   │
          └───────────────────┴───────────────────┘
                              │
                              ▼
                   Centralized MySQL database
```

## Main modules

| Module | Responsibility |
|---|---|
| Authentication and authorization | Customer/admin login, protected routes, sessions, role checks, and admin device protection. |
| Order management | Standard, rush, pre-order, pickup, delivery, payment, cancellation, status changes, and notifications. |
| Customized cakes | Request details, admin review, quotation, downpayment, payment proof, and approval. |
| Inventory | Ingredients, batches, expiry dates, stock movements, thresholds, stock synchronization, and discard requests. |
| Sales and analytics | Imported sales history, revenue, product performance, order analysis, waste analysis, and diagnostics. |
| Forecasting | Daily product demand, statistical methods, rolling-origin backtesting, production planning, and ingredient recommendations. |
| Communication | Customer-admin chat, notifications, and realtime order/chat events. |

## Realtime synchronization

Business operations publish `order.updated` and `chat.updated` records to the
`realtime_events` table. The SSE endpoint filters events by audience:

- `admins` receives events for the admin stream.
- `user` receives only events for the affected customer.

The React client subscribes through `subscribeRealtime`. Order screens also
retain polling as a resilience fallback when an SSE connection is interrupted.
The publisher behavior is covered by
`laravel/tests/Unit/RealtimeEventPublisherTest.php`.

## Data boundaries

The centralized database stores customer identity, orders, customized cake
requests, products, recipes, ingredient batches, stock movements, waste,
imported sales history, messages, notifications, and realtime events. The
frontend does not directly write business records; it uses authenticated API
requests.

## Non-functional design

- Responsive layouts for desktop and mobile browsers.
- Backend authorization before protected data access.
- Database transactions and row locking for stock-changing operations.
- Idempotent/import-safe sales processing.
- Realtime updates with reconnecting SSE and polling fallback.
- Automated feature and unit tests for critical order, inventory, import,
  forecasting, and synchronization behavior.
