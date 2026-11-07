<?php

$laravelDirectory = __DIR__ . '/../laravel';
$autoload = $laravelDirectory . '/vendor/autoload.php';
if (is_file($autoload)) {
    require_once $autoload;
}

$dotenvSettings = class_exists(\Dotenv\Dotenv::class)
    ? \Dotenv\Dotenv::createArrayBacked($laravelDirectory)->safeLoad()
    : [];
$getSetting = static function (string $key, $default = null) use ($dotenvSettings) {
    if (array_key_exists($key, $dotenvSettings)) {
        return $dotenvSettings[$key];
    }

    return $_ENV[$key] ?? $_SERVER[$key] ?? (($value = getenv($key)) !== false ? $value : $default);
};

$host = (string) $getSetting('DB_HOST', 'localhost');
$port = (int) $getSetting('DB_PORT', 3306);
$user = (string) $getSetting('DB_USERNAME', 'root');
$password = (string) $getSetting('DB_PASSWORD', '');
$database = (string) $getSetting('DB_DATABASE', 'pastry_db');
$socket = (string) $getSetting('DB_SOCKET', '');
$charset = (string) $getSetting('DB_CHARSET', 'utf8mb4');
$db_error = "";
$connectionConfig = [];

// Laravel's cached configuration is authoritative after deployment; legacy endpoints must use it too.
$cachedConfigPath = $laravelDirectory . '/bootstrap/cache/config.php';
if (is_file($cachedConfigPath)) {
    $cachedConfig = require $cachedConfigPath;
    $defaultConnection = $cachedConfig['database']['default'] ?? '';
    $connectionConfig = $cachedConfig['database']['connections'][$defaultConnection] ?? [];
    if (in_array($connectionConfig['driver'] ?? '', ['mysql', 'mariadb'], true)) {
        $host = (string) ($connectionConfig['host'] ?? $host);
        $port = (int) ($connectionConfig['port'] ?? $port);
        $user = (string) ($connectionConfig['username'] ?? $user);
        $password = (string) ($connectionConfig['password'] ?? $password);
        $database = (string) ($connectionConfig['database'] ?? $database);
        $socket = (string) ($connectionConfig['unix_socket'] ?? $socket);
        $charset = (string) ($connectionConfig['charset'] ?? $charset);
    } else {
        $db_error = 'The configured Laravel database driver is not supported by this legacy endpoint.';
    }
}

$databaseUrl = trim((string) ($connectionConfig['url'] ?? $getSetting('DB_URL', '')));
if ($databaseUrl !== '') {
    $urlParts = parse_url($databaseUrl);
    if (!is_array($urlParts) || !in_array(strtolower((string) ($urlParts['scheme'] ?? '')), ['mysql', 'mariadb'], true)) {
        $db_error = 'DB_URL must be a valid MySQL or MariaDB connection URL.';
    } elseif (empty($urlParts['host']) || empty($urlParts['path'])) {
        $db_error = 'DB_URL must include a host and database name.';
    } else {
        $urlOptions = [];
        parse_str((string) ($urlParts['query'] ?? ''), $urlOptions);
        $host = $urlParts['host'];
        $port = (int) ($urlParts['port'] ?? 3306);
        $user = rawurldecode((string) ($urlParts['user'] ?? $user));
        $password = rawurldecode((string) ($urlParts['pass'] ?? $password));
        $database = rawurldecode(ltrim((string) $urlParts['path'], '/'));
        $socket = (string) ($urlOptions['unix_socket'] ?? $socket);
        $charset = (string) ($urlOptions['charset'] ?? $charset);
    }
}

mysqli_report(MYSQLI_REPORT_OFF);
$conn = $db_error === ''
    ? @mysqli_connect($host, $user, $password, $database, $port, $socket ?: null)
    : null;

if (!$conn) {
    if ($db_error === '') {
        $db_error = mysqli_connect_error();
    }
} else {
    $conn->set_charset($charset);
}

?>