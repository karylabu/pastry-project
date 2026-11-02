# Hostinger Backup Scheduler

Laravel runs the daily backup command through its scheduler. Hostinger's shell does not provide `crontab`, so configure the Laravel scheduler in hPanel.

1. Open **Websites → Manage → Advanced → Cron Jobs**.
2. Set the schedule to every minute (`* * * * *`).
3. Use this command:

```sh
/usr/bin/php /home/u446555584/domains/pastryproject.shop/public_html/laravel/artisan schedule:run >> /dev/null 2>&1
```

The saved daily time in Backup Management is in Philippine time. The page's **Automatic Schedule** status should change to **Running** after the cron has invoked Laravel. At the configured time, the scheduler creates a verified database backup and a full-system ZIP.

## Full system ZIP

The ZIP is stored in Laravel's private backup storage and can be created, downloaded, or deleted by an admin from **Admin → Backup Management → System Backup**. It contains the database SQL dump, deployed website/app files, uploaded files, and a SHA-256 manifest. It excludes `.env`, private database and mailer credentials, logs, caches, sessions, and existing backup files. The PHP ZIP extension must be enabled on the hosting server. The ZIP contains sensitive customer records; store downloaded copies securely.

The full ZIP is a download-and-manual-restore package, not an in-dashboard restore. Keep a separate Hostinger backup before restoring. Restore the site files and matching SQL dump through Hostinger/phpMyAdmin, then recover excluded connection and mail settings from the secure hosting configuration. Never place the ZIP in a public website directory.

## Database restore-test configuration

The separate database test endpoint is restricted to superadmins. To configure it, create a separate database in hPanel using the same database engine as the live database, then set `BACKUP_TEST_DB_CONNECTION`, `BACKUP_TEST_DB_HOST`, `BACKUP_TEST_DB_PORT`, `BACKUP_TEST_DB_DATABASE`, `BACKUP_TEST_DB_USERNAME`, and `BACKUP_TEST_DB_PASSWORD` in Laravel's private `.env`. Never set the test database name to the live database name. Refresh Laravel's configuration cache after changing `.env`.