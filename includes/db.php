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
$db_error = "";

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect(
    $host,
    $user,
    $password,
    $database,
    $port
);

if (!$conn) {
    $db_error = mysqli_connect_error();
    $conn = null;
} else {
    $conn->set_charset((string) $getSetting('DB_CHARSET', 'utf8mb4'));
}

?>