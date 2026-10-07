<?php

if (!function_exists('legacy_get_pdo')) {
    function legacy_get_pdo(): PDO
    {
        static $pdo = null;

        if ($pdo !== null) {
            return $pdo;
        }

        $app = function_exists('app') ? app() : null;

        if (!$app || !$app->bound('db')) {
            $autoload = __DIR__ . '/vendor/autoload.php';
            $bootstrap = __DIR__ . '/bootstrap/app.php';

            if (is_file($autoload) && is_file($bootstrap)) {
                require_once $autoload;

                $app = require $bootstrap;
                $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            }
        }

        if ($app && $app->bound('db')) {
            try {
                $pdo = $app->make('db')->connection()->getPdo();
                if ($pdo instanceof PDO) {
                    return $pdo;
                }
            } catch (\Throwable $e) {
                // Try the explicit Laravel environment settings before reporting a connection failure.
            }
        }

        $autoload = __DIR__ . '/vendor/autoload.php';
        if (is_file($autoload)) {
            require_once $autoload;
        }

        $dotenvSettings = class_exists(\Dotenv\Dotenv::class)
            ? \Dotenv\Dotenv::createArrayBacked(__DIR__)->safeLoad()
            : [];

        $getSetting = static function (string $key, $default = null) use ($dotenvSettings) {
            if (array_key_exists($key, $dotenvSettings)) {
                return $dotenvSettings[$key];
            }

            return $_ENV[$key] ?? $_SERVER[$key] ?? (($value = getenv($key)) !== false ? $value : $default);
        };

        $host = $getSetting('DB_HOST');
        $port = $getSetting('DB_PORT', 3306);
        $database = $getSetting('DB_DATABASE');
        $user = $getSetting('DB_USERNAME');
        $pass = $getSetting('DB_PASSWORD', '');
        $charset = $getSetting('DB_CHARSET', 'utf8mb4');

        if (!empty($host) && !empty($database) && $user !== null) {
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            return $pdo;
        }

        $legacyDb = __DIR__ . '/../includes/db.php';
        if (file_exists($legacyDb)) {
            $host = null;
            $port = 3306;
            $database = null;
            $user = null;
            $pass = null;
            $password = null;
            $charset = 'utf8mb4';

            include $legacyDb;

            if (!empty($host) && !empty($database)) {
                $legacyPassword = $pass !== null && $pass !== ''
                    ? $pass
                    : ($password ?? ($GLOBALS['password'] ?? ''));
                $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";
                $pdo = new PDO($dsn, $user ?? ($GLOBALS['user'] ?? ''), $legacyPassword, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
                return $pdo;
            }
        }

        throw new \PDOException('Unable to create legacy PDO connection: DB_HOST, DB_DATABASE, and DB_USERNAME are missing from Laravel config, the environment, and legacy DB settings.');
    }
}

if (!function_exists('db')) {
    function db(): PDO
    {
        return legacy_get_pdo();
    }
}

if (!function_exists('db_run')) {
    function db_run(string $sql, array $params = [])
    {
        $pdo = db();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}

if (!function_exists('db_all')) {
    function db_all(string $sql, array $params = []): array
    {
        $stmt = db_run($sql, $params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}

if (!function_exists('db_one')) {
    function db_one(string $sql, array $params = []): ?array
    {
        $stmt = db_run($sql, $params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }
}

if (!function_exists('db_insert_id')) {
    function db_insert_id()
    {
        return db()->lastInsertId();
    }
}
