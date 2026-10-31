# Hostinger Backup Scheduler

Laravel runs the daily backup command through its scheduler. Hostinger's shell does not provide `crontab`, so configure the Laravel scheduler in hPanel.

1. Open **Websites → Manage → Advanced → Cron Jobs**.
2. Set the schedule to every minute (`* * * * *`).
3. Use this command:

```sh
/usr/bin/php /home/u446555584/domains/pastryproject.shop/public_html/laravel/artisan schedule:run >> /dev/null 2>&1
```

The saved daily time in Backup Management is in Philippine time. The page's **Automatic Schedule** status should change to **Running** after the cron has invoked Laravel.

## Restore test database

To enable **Test restore**, create a separate database in hPanel using the same database engine as the live database, then set `BACKUP_TEST_DB_CONNECTION`, `BACKUP_TEST_DB_HOST`, `BACKUP_TEST_DB_PORT`, `BACKUP_TEST_DB_DATABASE`, `BACKUP_TEST_DB_USERNAME`, and `BACKUP_TEST_DB_PASSWORD` in Laravel's private `.env`. Never set the test database name to the live database name. Refresh Laravel's configuration cache after changing `.env`.