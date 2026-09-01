# Pastry Project — Database Documentation (pastry_db)

> Last reviewed: 2026-08-25. This document matches the **actual**
> implementation — nothing documented here is aspirational.
>
> Schema changes are made ONLY through versioned migrations in
> `database/migrations/` (see `migrations/README.md`). No production API
> runs `CREATE TABLE` / `ALTER TABLE` at request time.

---

## 1. Source of truth decisions

| Concept | Source of truth | Notes |
|---|---|---|
| Product catalogue | `products` | One row per sellable item; `stock` = finished-goods on hand |
| Product sizes/prices | `product_sizes` | ONE row per `(product_id, size)` — enforced by UNIQUE key. `product_variants` is legacy and unused by live code paths that matter (see §6) |
| Recipes | `product_recipes` | product_id + ingredient_id + qty per unit produced |
| Ingredient stock | `ingredients.stock` | Single authoritative quantity per ingredient |
| Finished-product stock | `products.stock` | Single authoritative quantity per product |
| Transaction history | `product_inventory_movements`, `ingredient_inventory_movements` | Append-only ledger; never updated, only inserted |
| Orders | `orders` (+ `order_items`) | Historical snapshot fields preserved on the order row |

**Rule:** a stock quantity lives in exactly one place (`products.stock`
or `ingredients.stock`). Everything else is derived or historical.

---

## 2. Tables

### Users & access
| Table | PK | Key columns / constraints |
|---|---|---|
| `users` | `id` AI | `email` UNIQUE, `role` ENUM('customer','staff','admin'), `password`, `phone`, `username`, `profile_image`, `address/city/postal_code` |
| `user_sessions` | `id` AI | FK `user_id → users.id` ON DELETE CASCADE; `token` UNIQUE |
| `password_resets` | `id` AI | `email` (indexed), 6-digit `token`, `expires_at`, `used` |
| `audit_log` | `id` AI PK (added by migration 02) | `user_id`, `context`, `action`, `entity_type`, `entity_id`, `note`, `created_at` (indexed) |
| `addresses` | `address_id` AI | FK `customer_id → users.id` CASCADE; one default per user enforced in app logic |

### Catalogue
| Table | PK | Key columns / constraints |
|---|---|---|
| `products` | `id` AI | `name`, `category`, `price`, `stock` (finished goods), `image`; UNIQUE `(name, category)` |
| `product_sizes` | `id` AI | FK `product_id → products.id` CASCADE; `size` VARCHAR(30); `price`, `available`; UNIQUE `(product_id, size)` |
| `ingredients` | `id` AI | `name` UNIQUE, `unit`, `stock`, `threshold` (reorder point), `cost` |
| `product_recipes` | `id` AI | FK `product_id → products.id`, FK `ingredient_id → ingredients.id`; `qty` used per unit |

### Inventory ledger (append-only)
| Table | PK | Purpose |
|---|---|---|
| `product_inventory_movements` | `id` AI | Every finished-product change: `movement_type` ('Order','Cancellation','Production','Adjustment','Waste',…), signed `quantity`, `previous_stock`, `new_stock`, `reference_type`+`reference_id` (order/production/waste id), `user_id`, `notes`, indexed `created_at` |
| `ingredient_inventory_movements` | `id` AI | Same pattern for ingredients: 'Production','Restock','Adjustment','Waste'; FK `user_id → users.id` SET NULL (migration 05) |
| `production_transactions` | `id` AI | One row per production run: product, qty produced, unit cost, total cost, `idempotency_key` UNIQUE (prevents double-posting the same run) |
| `ingredient_consumption` | `id` AI | Per-run ingredient usage: FK to production run, ingredient, qty consumed, cost at time of use |
| `waste_records` | `id` AI | Waste events: product OR ingredient, qty, reason, recorded user, date |

### Orders & sales
| Table | PK | Key columns / constraints |
|---|---|---|
| `orders` | `id` AI | `user_id` (nullable, links guest orders via email instead), `customer`, `email` (indexed), `items` JSON snapshot, `subtotal/delivery_fee/total`, `method`, `payment`, `status` ENUM('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') (indexed), `order_type`, `created_at` (indexed), GCash payment fields |
| `order_items` | `id` AI | FK `order_id → orders.id` NOT NULL CASCADE (migration 04); `product_id → products.id` (nullable for deleted products); historical snapshot: `product` name, `qty`, `price` at purchase time |
| `custom_cake_orders` | `id` AI | FK `order_id → orders.id` CASCADE (migration 05); cake spec details |
| `customize_orders` | `id` AI | Legacy custom-cake request form (no link to real orders); FK `user_id → users.id` CASCADE. Kept for compatibility with `customer/api_customize_orders.php` |
| `notifications` | `id` AI | Per-user notifications: `user_id`, `title`, `message`, `type`, `action_url`, `is_read` |
| `messages` | `id` AI | Order chat: `order_id`, `user_id`, `sender` ENUM('customer','staff','ai','admin'), `message`, `is_read` |

### Analytics (regenerated on demand)
| Table | PK | Purpose |
|---|---|---|
| `analytics_imports` | `id` AI | CSV import metadata |
| `analytics_sales_history` | `id` AI | Imported sales rows (product_name, sale_date, units_sold); indexed (product_name, sale_date) |
| `analytics_forecasts` | `id` AI | 7-day demand projections per product |
| `analytics_reorder_logs` | `id` AI | Recommended reorder quantities |
| `analytics_procurement_alerts` | `id` AI | High-priority procurement warnings |

These are cleared and rebuilt by `admin/api/api_predictive_analytics.php`
on refresh/import. They are derived data — safe to drop/rebuild.

---

## 3. Flows

### Order flow
1. Customer places order → `orders` row (Pending) + `order_items` rows
   (name/qty/price snapshot) + "Order Placed" notification.
2. Staff sets status → **Confirmed**: inventory deducted atomically
   (`products.stock -= qty`, movement row type 'Order' with reference to
   the order). Idempotency guard: an order is only deducted while
   deductions > restorations in its movement history.
3. Status → Cancelled: previously deducted quantities are restored
   (movement type 'Cancellation'). Never double-restored.
4. Other status transitions do not touch stock.

### Production flow
1. Production run posted with an idempotency key →
   `production_transactions`.
2. Ingredients deducted per recipe → `ingredient_consumption` +
   negative movements in `ingredient_inventory_movements`.
3. Finished goods added → `products.stock += qty` + positive movement in
   `product_inventory_movements`.

### Waste flow
Waste event → `waste_records` + negative movement in the appropriate
ledger (`product_inventory_movements` or
`ingredient_inventory_movements`) with reason preserved.

### Movement ledger rules
- Ledger rows are INSERT-only. Corrections are new compensating rows,
  never edits of history.
- Each row stores previous/new stock so any point-in-time balance can be
  reconstructed and audited.
- Rows reference actors by `user_id` (SET NULL if user removed) and
  store human-readable notes.

---

## 4. Foreign keys currently enforced

| Child | Parent | On delete |
|---|---|---|
| product_sizes.product_id | products.id | CASCADE |
| order_items.order_id | orders.id | CASCADE |
| order_items.product_id | products.id | (per schema definition) |
| addresses.customer_id | users.id | CASCADE |
| user_sessions.user_id | users.id | CASCADE |
| customize_orders.user_id | users.id | CASCADE |
| custom_cake_orders.order_id | orders.id | CASCADE |
| ingredient_movements.user_id | users.id | SET NULL |
| production/consumption tables | products/ingredients | per schema |

Deliberately NOT constrained (documented decision): ledger tables'
`reference_id` polymorphic references (they point at different tables
depending on `reference_type`).

## 5. Unique constraints

- `users.email`
- `products (name, category)`
- `ingredients.name`
- `product_sizes (product_id, size)`
- `favorites (customer_id, product_id)`
- `user_sessions.token`
- `production_transactions.idempotency_key`

## 6. Variant/size resolution (final)

`product_sizes` is the single source of truth for size-specific pricing
and availability. The legacy `product_variants` table is retained but
unused by active code paths; it must not be written to by new features.
Do not reintroduce a second sizing system.

## 7. Legacy / unused tables (retained, not dropped)

- `product_variants` — superseded by `product_sizes`.
- `sales_daily_snapshots`, `demand_forecasts`,
  `reorder_recommendations`, `reorder_logs`, `procurement_alerts`,
  `simulated_baselines` — old ID-based analytics tables; no live code
  references them. Superseded by the `analytics_*` family.
- Archive tables created during cleanup:
  `product_sizes_archive` (full pre-dedupe snapshot),
  `order_items_orphan_archive` (158 orphaned historical order lines,
  preserved because they are historical transaction information).

None of these may be dropped without a documented migration and backup.

## 8. Backup & rollback

See `database/migrations/README.md`. Summary:

1. `database\backup_db.bat` → timestamped full dump in
   `database/backups/`. Run before every migration.
2. Targeted rollbacks in `database/migrations/rollback/`.
3. Full restore: `mysql -u root pastry_db < backups\<dump>.sql`.
4. Test destructive migrations on a scratch copy first.

## 9. Known compatibility notes

- `customer/api_register.php` still contains a defensive
  `CREATE TABLE IF NOT EXISTS users` (kept intentionally as a
  bootstrap safeguard; harmless because the table exists).
- Copies of customer APIs under `laravel/public/customer/` are legacy
  mirrors and were not modified; the live API root is `/customer/`.
- Guest orders keep `user_id NULL` and are linked to users by email at
  notification time.