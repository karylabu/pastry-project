<?php

if (!function_exists('legacy_get_pdo')) {
    function legacy_get_pdo(): PDO
    {
        static $pdo = null;

        if ($pdo !== null) {
            return $pdo;
        }

        $host = '127.0.0.1';
        $port = 3306;
        $database = '';
        $user = 'root';
        $pass = '';
        $charset = 'utf8mb4';

        $connected = false;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        if (function_exists('config')) {
            try {
                $conn = config('database.connections.' . config('database.default'));

                $host = $conn['host'] ?? $host;
                $port = $conn['port'] ?? $port;
                $database = $conn['database'] ?? $database;
                $user = $conn['username'] ?? $user;
                $pass = $conn['password'] ?? $pass;
                $charset = $conn['charset'] ?? $charset;

                $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";
                $pdo = new PDO($dsn, $user, $pass, $options);
                return $pdo;
            } catch (\Throwable $e) {
                // fall through to legacy config fallback
            }
        }

        $legacyDb = __DIR__ . '/../includes/db.php';
        if (file_exists($legacyDb)) {
            include $legacyDb;

            if (!empty($host) && !empty($database)) {
                $dsn2 = "mysql:host={$host};dbname={$database};charset={$charset}";
                try {
                    $pdo = new PDO($dsn2, $user ?? ($GLOBALS['user'] ?? ''), $pass ?? ($GLOBALS['password'] ?? ''), $options);
                    return $pdo;
                } catch (\PDOException $e2) {
                    // fall through to final exception
                }
            }
        }

        throw new \PDOException('Unable to create legacy PDO connection: missing config or legacy DB settings.');
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
