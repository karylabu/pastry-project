<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

## Sales CSV imports

CSV sales reports are stored privately and processed by the database queue in batches of 1,000 rows. Exact file retries are rejected by a SHA-256 fingerprint. Each file is limited to 50 MB and 250,000 data rows; split larger reports before uploading. The import status endpoint reports queued/processing/completed/failed state and row progress.

Run migrations, configure `QUEUE_CONNECTION=database`, and keep a queue worker running:

```powershell
php artisan migrate --force
php artisan queue:work database --queue=default --timeout=900 --tries=3
```

The database queue's `retry_after` must remain higher than the worker timeout (the application default is 1,200 seconds). Configure PHP's `upload_max_filesize` and `post_max_size` to at least 50 MB. The queue worker must use the same database and local storage volume as the web application. In production, supervise the worker so it restarts after failures and deployments.

## Production deployment checklist

- Configure the production `.env` with `APP_ENV=production`, `APP_DEBUG=false`, the HTTPS `APP_URL`, a generated `APP_KEY`, and the production database credentials. Do not deploy a development `.env` or commit it.
- Set `QUEUE_CONNECTION=database` and `CORS_ALLOWED_ORIGINS` to the exact frontend origin(s), comma-separated, when the frontend is hosted on a different origin. Keep credentials enabled; do not use `*` for credentialed CORS.
- Build the customer portal with `REACT_APP_LARAVEL_BASE` set to the public Laravel API base URL if it differs from the default same-origin `/laravel/public` path. Frontend `REACT_APP_*` values are embedded at build time and must not contain secrets.
- Point the web server's document root at the project entry point or configure the root `.htaccess` rewrite rules for the chosen project path. The Laravel `public` directory should not be exposed as a separate public document root unless the frontend URLs are configured to match it.
- Load the application's existing core database schema before running Laravel migrations; most legacy business tables are managed outside Laravel's migration history. Back up the database before migrating.
- Run `php artisan config:cache` after setting production environment values, then restart the application and its supervised queue worker. Confirm the worker can read the same private storage volume used by web requests.
