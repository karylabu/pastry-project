# Database Migrations — pastry_db

Schema changes are **never** made automatically by API requests.
All schema/data-structure changes go through the versioned SQL files in
this folder, applied manually in order.

## How to apply a migration

1. **Back up first** (mandatory for any migration that alters data):

   ```bat
   database\backup_db.bat
   ```

   This writes `database/backups/pastry_db_<timestamp>.sql`.

2. Apply the migration:

   ```
   C:\xampp\mysql\bin\mysql.exe -u root < database\migrations\<file>.sql
   ```

3. Verify (spot-check row counts / `SHOW CREATE TABLE`).

## Rollback

Each migration that changes or deletes data has a matching file in
`rollback/`. Rollbacks are only safe when run immediately after their
migration, before new application data depends on the new structure.

For a full restore instead of a targeted rollback:

```
C:\xampp\mysql\bin\mysql.exe -u root pastry_db < database\backups\pastry_db_<timestamp>.sql
```

**Never test destructive migrations against the only copy of the
database.** Test on a scratch copy:

```
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE pastry_db_test"
C:\xampp\mysql\bin\mysqldump.exe -u root pastry_db | C:\xampp\mysql\bin\mysql.exe -u root pastry_db_test
# apply migration against pastry_db_test, verify, then apply to pastry_db
```

## Applied migrations (in order)

| File | Purpose |
|------|---------|
| `2026_08_25_inventory_tracking.sql` | Movement ledger + production idempotency groundwork (pre-existing) |
| `2026_08_25_production_idempotency.sql` | `production_transactions.idempotency_key` unique key (pre-existing) |
| `2026_08_25_01_user_sessions.sql` | Create `user_sessions` (was runtime-created on every login) |
| `2026_08_25_02_audit_log_primary_key.sql` | Renumber duplicated ids; add PK + auto_increment to `audit_log` |
| `2026_08_25_03_product_sizes_dedupe.sql` | Archive & remove duplicate size rows; widen `size` ENUM→VARCHAR(30); add UNIQUE(product_id,size) |
| `2026_08_25_04_order_items_integrity.sql` | Archive orphan order_items; backfill product_id; NOT NULL + FK to orders |
| `2026_08_25_05_constraints_and_indexes.sql` | Safe FKs (ingredient_movements.user_id, custom_cake_orders.order_id); UNIQUE products(name,category), ingredients(name); indexes on orders/password_resets |
| `2026_08_25_06_analytics_tables.sql` | Create analytics_* tables as a proper migration (replaces runtime DDL in admin API) |
| `2026_08_25_07_runtime_ddl_tables.sql` | messages.user_id/updated_at/sender ENUM, users.profile_image, customize_orders (all previously ensured at runtime by APIs) |

Archive tables created by these migrations (`product_sizes_archive`,
`order_items_orphan_archive`) are intentional audit trails — do not drop
them casually.