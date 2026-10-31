<?php

namespace App\Services;

use App\Models\AdminNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PDO;
use RuntimeException;
use Throwable;

class DatabaseBackupService
{
    private const DIRECTORY = 'backups';
    private const HISTORY_FILE = 'backups/history.json';
    private const SCHEDULER_HEARTBEAT = 'backups/scheduler-heartbeat.json';
    private const FORMAT_HEADER = '-- pastry-project-sql-backup:v1';
    private const FORMAT_FOOTER = '-- pastry-project-sql-backup:end:v1';

    public function overview(string $scheduleTime = '02:00'): array
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        $files = array_values(array_filter(
            $disk->files(self::DIRECTORY),
            static fn (string $path): bool => str_ends_with(strtolower($path), '.sql')
        ));
        $storageUsed = array_sum(array_map(static fn (string $path): int => (int) $disk->size($path), $files));
        $items = $this->readHistory();

        foreach ($items as &$item) {
            $path = self::DIRECTORY . '/' . $item['filename'];
            if (($item['status'] ?? '') === 'successful'
                && (! $disk->exists($path) || (int) $disk->size($path) <= 0 || ! is_readable($disk->path($path)))) {
                $item['status'] = 'failed';
                $item['verification_status'] = 'failed';
                $item['size_bytes'] = 0;
            } elseif ($disk->exists($path)) {
                $item['size_bytes'] = (int) $disk->size($path);
            }
        }
        unset($item);

        usort($items, static fn (array $left, array $right): int => strcmp(
            (string) ($right['created_at'] ?? ''),
            (string) ($left['created_at'] ?? '')
        ));

        $latestScheduledIndex = null;
        $latestSuccessfulIndex = null;
        foreach ($items as $index => $item) {
            if ($latestScheduledIndex === null && ($item['purpose'] ?? null) === 'scheduled') {
                $latestScheduledIndex = $index;
            }
            if ($latestSuccessfulIndex === null && ($item['status'] ?? null) === 'successful') {
                $latestSuccessfulIndex = $index;
            }
        }
        $indexesToVerify = array_unique(array_filter([$latestScheduledIndex, $latestSuccessfulIndex], static fn ($index): bool => $index !== null));
        foreach ($indexesToVerify as $index) {
            if (($items[$index]['status'] ?? null) !== 'successful') {
                continue;
            }
            $item = $items[$index];
            if (! empty($item['sha256'])) {
                try {
                    $verification = $this->verifySqlBackup(
                        $disk->path(self::DIRECTORY . '/' . $item['filename']),
                        $item['sha256']
                    );
                    $items[$index] = array_merge($item, $verification);
                } catch (Throwable $exception) {
                    $items[$index] = $this->recordVerificationFailure($item, $exception);
                }
            } else {
                $items[$index]['verification_status'] = 'unverified';
            }
        }

        $availableBackups = count(array_filter($items, static fn (array $item): bool =>
            ($item['status'] ?? null) === 'successful'
            && isset($item['filename'])
            && is_file(Storage::disk('local')->path(self::DIRECTORY . '/' . $item['filename']))
            && is_readable(Storage::disk('local')->path(self::DIRECTORY . '/' . $item['filename']))
            && (int) @filesize(Storage::disk('local')->path(self::DIRECTORY . '/' . $item['filename'])) > 0
        ));
        $verifiedBackups = count(array_filter($items, static fn (array $item): bool =>
            ($item['status'] ?? null) === 'successful' && ($item['verification_status'] ?? null) === 'verified'
        ));
        $lastVerifiedBackup = collect($items)->first(static fn (array $item): bool =>
            ($item['status'] ?? null) === 'successful' && ($item['verification_status'] ?? null) === 'verified'
        );
        $lastVerifiedScheduledBackup = collect($items)->first(static fn (array $item): bool =>
            ($item['purpose'] ?? null) === 'scheduled'
            && ($item['status'] ?? null) === 'successful'
            && ($item['verification_status'] ?? null) === 'verified'
        );
        $lastScheduledBackup = collect($items)->first(static fn (array $item): bool => ($item['purpose'] ?? null) === 'scheduled');
        $latestBackup = $items[0] ?? null;
        $storage = $this->storageStatus($disk->path(self::DIRECTORY));
        $scheduler = $this->schedulerStatus($disk);
        $health = $this->healthStatus($scheduleTime, $lastVerifiedBackup, $lastVerifiedScheduledBackup, $lastScheduledBackup, $latestBackup, $storage, $scheduler);

        return [
            'backups' => array_values($items),
            'overview' => [
                'last_backup' => $items[0] ?? null,
                'last_successful_backup' => $lastVerifiedBackup,
                'last_verified_backup' => $lastVerifiedBackup,
                'last_scheduled_backup' => $lastScheduledBackup,
                'latest_verification' => $lastScheduledBackup['verification_status'] ?? 'unverified',
                'storage_status' => $storage,
                'scheduler_status' => $scheduler,
                'verified_backups' => $verifiedBackups,
                'available_backups' => $availableBackups,
                'total_backups' => count($files),
                'storage_used_bytes' => $storageUsed,
            ],
            'health' => $health,
        ];
    }

    public function create(string $type = 'manual', ?string $purpose = null): array
    {
        if (! in_array($type, ['manual', 'automatic'], true)) {
            throw new RuntimeException('Invalid backup type.');
        }
        $purpose ??= $type === 'manual' ? 'manual' : 'restore_safety';
        if (! in_array($purpose, ['manual', 'scheduled', 'restore_safety'], true)
            || ($type === 'manual' && $purpose !== 'manual')
            || ($type === 'automatic' && $purpose === 'manual')) {
            throw new RuntimeException('Invalid backup purpose.');
        }

        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        @chmod($disk->path(self::DIRECTORY), 0700);
        $createdAt = now();
        $filename = sprintf(
            'pastry-project-db-%s-%s.sql',
            $createdAt->format('Ymd-His'),
            Str::lower(Str::random(6))
        );
        $entry = [
            'id' => $filename,
            'filename' => $filename,
            'created_at' => $createdAt->toIso8601String(),
            'type' => $type,
            'purpose' => $purpose,
            'status' => 'in_progress',
            'size_bytes' => 0,
        ];
        $history = $this->readHistory();
        array_unshift($history, $entry);
        $this->writeHistory($history);

        $temporaryPath = $disk->path(self::DIRECTORY . '/.' . $filename . '.tmp');
        $backupPath = $disk->path(self::DIRECTORY . '/' . $filename);

        try {
            $this->writeSqlDump($temporaryPath);
            $verification = $this->verifySqlBackup($temporaryPath);
            if (! @rename($temporaryPath, $backupPath)) {
                throw new RuntimeException('Unable to publish the completed backup file.');
            }
            @chmod($backupPath, 0600);
            $verification = $this->verifySqlBackup($backupPath, $verification['sha256']);

            $entry['status'] = 'successful';
            $entry = array_merge($entry, $verification);
            $this->replaceHistoryEntry($entry);

            return $entry;
        } catch (Throwable $exception) {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }

            $entry['status'] = 'failed';
            $entry['verification_status'] = 'failed';
            $entry['verification_error'] = 'The backup could not be completed and verified.';
            $this->replaceHistoryEntry($entry);
            Log::error('Database SQL backup failed.', ['filename' => $filename, 'exception' => $exception]);

            throw new RuntimeException('The database backup could not be completed.', 0, $exception);
        }
    }

    public function downloadPath(string $filename): string
    {
        $entry = $this->findEntry($filename);
        $path = Storage::disk('local')->path(self::DIRECTORY . '/' . $entry['filename']);

        if (($entry['status'] ?? '') !== 'successful' || ! is_file($path) || (int) filesize($path) <= 0 || ! is_readable($path)) {
            throw new \InvalidArgumentException('Backup file not found.');
        }
        if (! empty($entry['sha256'])) {
            try {
                $this->verifySqlBackup($path, $entry['sha256']);
            } catch (Throwable $exception) {
                $this->recordVerificationFailure($entry, $exception);
                throw $exception;
            }
        }

        return $path;
    }

    public function verifyBackup(string $filename): array
    {
        $entry = $this->findEntry($filename);
        if (($entry['status'] ?? null) !== 'successful' || empty($entry['sha256'])) {
            throw new RuntimeException('This backup has not passed file verification.');
        }

        $path = Storage::disk('local')->path(self::DIRECTORY . '/' . $entry['filename']);

        try {
            return $this->verifySqlBackup($path, $entry['sha256']);
        } catch (Throwable $exception) {
            $this->recordVerificationFailure($entry, $exception);
            throw $exception;
        }
    }

    public function testRestoreConfigured(): bool
    {
        $testConfig = config('database.connections.backup_test');
        if (! is_array($testConfig) || empty($testConfig['database']) || ! empty($testConfig['url'])) {
            return false;
        }
        if (in_array(strtolower((string) ($testConfig['driver'] ?? '')), ['mysql', 'mariadb'], true)
            && (empty($testConfig['host']) || empty($testConfig['username']))) {
            return false;
        }

        return ! $this->sameDatabase($testConfig, DB::connection()->getConfig());
    }

    public function testRestore(string $filename): array
    {
        $entry = $this->findEntry($filename);
        if (($entry['status'] ?? null) !== 'successful' || ($entry['verification_status'] ?? null) !== 'verified' || empty($entry['sha256'])) {
            throw new RuntimeException('This backup has not passed verification and cannot be tested.');
        }
        if (! $this->testRestoreConfigured()) {
            throw new RuntimeException('A separate restore-test database is not configured. The live database was not changed.');
        }

        $testConfig = config('database.connections.backup_test');
        $testDriver = strtolower((string) ($testConfig['driver'] ?? ''));
        if (! in_array($testDriver, ['mysql', 'mariadb', 'sqlite'], true)) {
            throw new RuntimeException('The restore-test database driver is not supported.');
        }

        $backupPath = $this->downloadPath($filename);
        $this->applyDump($backupPath, 'backup_test');
        $tableCount = count($this->tableNames($testDriver === 'mariadb' ? 'mysql' : $testDriver, 'backup_test'));
        if ($tableCount === 0) {
            throw new RuntimeException('The test database did not contain any restored tables.');
        }

        return [
            'verified' => true,
            'backup' => $entry,
            'tables_restored' => $tableCount,
            'tested_at' => now()->toIso8601String(),
        ];
    }

    public function delete(string $filename): void
    {
        $entry = $this->findEntry($filename);
        $disk = Storage::disk('local');
        $disk->delete(self::DIRECTORY . '/' . $entry['filename']);

        $history = array_values(array_filter(
            $this->readHistory(),
            static fn (array $item): bool => ($item['filename'] ?? null) !== $filename
        ));
        $this->writeHistory($history);
    }

    public function restore(string $filename): array
    {
        $entry = $this->findEntry($filename);
        if (($entry['status'] ?? '') !== 'successful' || ($entry['verification_status'] ?? null) !== 'verified' || empty($entry['sha256'])) {
            throw new \InvalidArgumentException('Backup file not found.');
        }

        $backupPath = $this->downloadPath($filename);
        $safetyBackup = $this->create('automatic', 'restore_safety');
        $safetyPath = $this->downloadPath($safetyBackup['filename']);

        try {
            $this->applyDump($backupPath);
        } catch (Throwable $exception) {
            try {
                $this->applyDump($safetyPath);
            } catch (Throwable $recoveryException) {
                Log::critical('Automatic database recovery after a failed restore also failed.', [
                    'restore_filename' => $filename,
                    'safety_filename' => $safetyBackup['filename'],
                    'exception' => $recoveryException,
                ]);

                throw new RuntimeException('Restore failed and automatic recovery was unsuccessful. Contact support before making further changes.', 0, $exception);
            }

            throw new RuntimeException('Restore failed. The database was returned to its pre-restore state.', 0, $exception);
        }

        return [
            'restored_backup' => $entry,
            'safety_backup' => $safetyBackup,
        ];
    }

    public function hasSuccessfulScheduledBackupOn(string $date): bool
    {
        foreach ($this->readHistory() as $entry) {
            if (($entry['purpose'] ?? null) === 'scheduled'
                && ($entry['status'] ?? null) === 'successful'
                && str_starts_with((string) ($entry['created_at'] ?? ''), $date)) {
                return true;
            }
        }

        return false;
    }

    private function writeSqlDump(string $path): void
    {
        $driver = $this->supportedDriver();
        $connection = DB::connection();
        $handle = @fopen($path, 'wb');
        if (! is_resource($handle)) {
            throw new RuntimeException('Unable to open a private backup file.');
        }

        try {
            $this->write($handle, self::FORMAT_HEADER . "\n");
            $this->write($handle, '-- driver:' . $driver . "\n");
            $this->write($handle, '-- created_at:' . now()->toIso8601String() . "\n\n");
            $this->write($handle, $driver === 'sqlite' ? "PRAGMA foreign_keys=OFF;\n" : "SET FOREIGN_KEY_CHECKS=0;\n");

            if ($driver === 'sqlite') {
                $this->writeSqliteDump($handle, $connection);
            } else {
                $this->writeMysqlDump($handle, $connection, $driver);
            }

            $this->write($handle, $driver === 'sqlite' ? "PRAGMA foreign_keys=ON;\n" : "SET FOREIGN_KEY_CHECKS=1;\n");
            $this->write($handle, self::FORMAT_FOOTER . "\n");
            if (! fflush($handle)) {
                throw new RuntimeException('Unable to finish writing the backup file.');
            }
            if (function_exists('fsync') && ! fsync($handle)) {
                throw new RuntimeException('Unable to sync the completed backup to storage.');
            }
        } finally {
            fclose($handle);
        }
    }

    private function writeMysqlDump($handle, $connection, string $driver): void
    {
        foreach ($this->tableNames($driver) as $table) {
            $quotedTable = $this->quoteIdentifier($table, $driver);
            $createRow = $connection->selectOne('SHOW CREATE TABLE ' . $quotedTable);
            $createValues = array_values((array) $createRow);
            $createSql = $createValues[1] ?? null;
            if (! is_string($createSql) || $createSql === '') {
                throw new RuntimeException('Unable to read a database table definition.');
            }

            $this->write($handle, 'DROP TABLE IF EXISTS ' . $quotedTable . ";\n");
            $this->write($handle, rtrim($createSql, ";\r\n") . ";\n");
            $this->writeRows($handle, $table, $driver, $connection->getPdo());
        }
    }

    private function writeSqliteDump($handle, $connection): void
    {
        $tables = $connection->select("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        foreach ($tables as $tableRow) {
            $table = (string) $tableRow->name;
            $createSql = (string) $tableRow->sql;
            if ($createSql === '') {
                continue;
            }

            $quotedTable = $this->quoteIdentifier($table, 'sqlite');
            $this->write($handle, 'DROP TABLE IF EXISTS ' . $quotedTable . ";\n");
            $this->write($handle, rtrim($createSql, ";\r\n") . ";\n");
            $this->writeRows($handle, $table, 'sqlite', $connection->getPdo());
        }

        $schemaObjects = $connection->select("SELECT sql FROM sqlite_master WHERE type IN ('index', 'view') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'index' THEN 0 ELSE 1 END, name");
        foreach ($schemaObjects as $schemaObject) {
            $this->write($handle, rtrim((string) $schemaObject->sql, ";\r\n") . ";\n");
        }
    }

    private function writeRows($handle, string $table, string $driver, PDO $pdo): void
    {
        $quotedTable = $this->quoteIdentifier($table, $driver);
        foreach (DB::table($table)->cursor() as $row) {
            $values = [];
            $columns = [];
            foreach ((array) $row as $column => $value) {
                $columns[] = $this->quoteIdentifier((string) $column, $driver);
                $values[] = $this->quoteValue($value, $pdo, $driver);
            }

            if ($columns !== []) {
                $this->write(
                    $handle,
                    'INSERT INTO ' . $quotedTable . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ");\n"
                );
            }
        }
    }

    private function applyDump(string $path, ?string $connectionName = null): void
    {
        $contents = @file_get_contents($path);
        if (! is_string($contents) || ! str_starts_with($contents, self::FORMAT_HEADER . "\n")) {
            throw new RuntimeException('The selected file is not a supported Pastry Project SQL backup.');
        }

        $driver = $this->supportedDriver($connectionName);
        if (! preg_match('/^-- driver:([a-z]+)$/m', $contents, $matches) || $matches[1] !== $driver) {
            throw new RuntimeException('This backup was created for a different database driver.');
        }

        $connection = DB::connection($connectionName);
        $pdo = $connection->getPdo();
        $this->setForeignKeys($pdo, $driver, false);

        try {
            foreach ($this->tableNames($driver, $connectionName) as $table) {
                $pdo->exec('DROP TABLE IF EXISTS ' . $this->quoteIdentifier($table, $driver));
            }

            foreach ($this->splitStatements($contents, $driver) as $statement) {
                if (preg_match('/^(SET\s+FOREIGN_KEY_CHECKS|PRAGMA\s+foreign_keys)\b/i', ltrim($statement))) {
                    continue;
                }
                $pdo->exec($statement);
            }
        } finally {
            $this->setForeignKeys($pdo, $driver, true);
        }
    }

    private function splitStatements(string $sql, string $driver): array
    {
        $statements = [];
        $statement = '';
        $quote = null;
        $lineComment = false;
        $blockComment = false;
        $length = strlen($sql);

        for ($index = 0; $index < $length; $index++) {
            $character = $sql[$index];
            $next = $sql[$index + 1] ?? '';

            if ($lineComment) {
                if ($character === "\n") {
                    $lineComment = false;
                    $statement .= "\n";
                }
                continue;
            }

            if ($blockComment) {
                if ($character === '*' && $next === '/') {
                    $blockComment = false;
                    $statement .= ' ';
                    $index++;
                }
                continue;
            }

            if ($quote !== null) {
                $statement .= $character;
                if ($character === '\\' && $driver !== 'sqlite' && $quote !== '`' && $next !== '') {
                    $statement .= $next;
                    $index++;
                    continue;
                }
                if ($character === $quote) {
                    if ($next === $quote) {
                        $statement .= $next;
                        $index++;
                    } else {
                        $quote = null;
                    }
                }
                continue;
            }

            if (($character === '-' && $next === '-' && (($sql[$index + 2] ?? '') === '' || ctype_space($sql[$index + 2]))) || $character === '#') {
                $lineComment = true;
                if ($character === '-') {
                    $index++;
                }
                continue;
            }
            if ($character === '/' && $next === '*') {
                $blockComment = true;
                $index++;
                continue;
            }
            if (in_array($character, ["'", '"', '`'], true)) {
                $quote = $character;
                $statement .= $character;
                continue;
            }
            if ($character === ';') {
                $trimmed = trim($statement);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $statement = '';
                continue;
            }

            $statement .= $character;
        }

        $trimmed = trim($statement);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }

    private function tableNames(string $driver, ?string $connectionName = null): array
    {
        $connection = DB::connection($connectionName);
        if ($driver === 'sqlite') {
            return array_map(
                static fn (object $row): string => (string) $row->name,
                $connection->select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            );
        }

        $tables = $connection->select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");

        return array_values(array_filter(array_map(
            static fn (object $row): string => (string) (array_values((array) $row)[0] ?? ''),
            $tables
        )));
    }

    private function supportedDriver(?string $connectionName = null): string
    {
        $driver = strtolower((string) DB::connection($connectionName)->getDriverName());
        if (! in_array($driver, ['mysql', 'mariadb', 'sqlite'], true)) {
            throw new RuntimeException('SQL backups are currently supported for MySQL, MariaDB, and SQLite databases.');
        }

        return $driver === 'mariadb' ? 'mysql' : $driver;
    }

    private function setForeignKeys(PDO $pdo, string $driver, bool $enabled): void
    {
        $pdo->exec($driver === 'sqlite'
            ? 'PRAGMA foreign_keys=' . ($enabled ? 'ON' : 'OFF')
            : 'SET FOREIGN_KEY_CHECKS=' . ($enabled ? '1' : '0'));
    }

    private function quoteIdentifier(string $identifier, string $driver): string
    {
        if ($driver === 'sqlite') {
            return '"' . str_replace('"', '""', $identifier) . '"';
        }

        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    private function quoteValue(mixed $value, PDO $pdo, string $driver): string
    {
        if ($value === null) {
            return 'NULL';
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        $value = (string) $value;
        if (preg_match('//u', $value) !== 1) {
            return "X'" . bin2hex($value) . "'";
        }

        $quoted = $pdo->quote($value, PDO::PARAM_STR);
        if (! is_string($quoted)) {
            throw new RuntimeException('Unable to encode a database value in the SQL backup.');
        }

        return $quoted;
    }

    private function write($handle, string $contents): void
    {
        if (fwrite($handle, $contents) !== strlen($contents)) {
            throw new RuntimeException('Unable to write the database backup file.');
        }
    }

    private function verifySqlBackup(string $path, ?string $expectedHash = null): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException('Backup file is missing or unreadable.');
        }

        $size = filesize($path);
        if (! is_int($size) || $size <= 0) {
            throw new RuntimeException('Backup file is empty.');
        }

        $handle = fopen($path, 'rb');
        if (! is_resource($handle)) {
            throw new RuntimeException('Backup file could not be opened for verification.');
        }

        try {
            $header = fgets($handle);
            $driverLine = fgets($handle);
            $footerLength = strlen(self::FORMAT_FOOTER) + 1;
            if ($size < $footerLength || fseek($handle, -$footerLength, SEEK_END) !== 0) {
                throw new RuntimeException('Backup file is incomplete.');
            }
            $footer = fread($handle, $footerLength);
        } finally {
            fclose($handle);
        }

        if ($header !== self::FORMAT_HEADER . "\n"
            || ! is_string($driverLine)
            || ! preg_match('/^-- driver:(mysql|sqlite)\n$/', $driverLine)
            || $footer !== self::FORMAT_FOOTER . "\n") {
            throw new RuntimeException('Backup file integrity markers do not match.');
        }

        $sha256 = hash_file('sha256', $path);
        if (! is_string($sha256) || ($expectedHash !== null && ! hash_equals($expectedHash, $sha256))) {
            throw new RuntimeException('Backup checksum verification failed.');
        }

        return [
            'size_bytes' => $size,
            'sha256' => $sha256,
            'verification_status' => 'verified',
            'verified_at' => now()->toIso8601String(),
        ];
    }

    private function recordVerificationFailure(array $entry, Throwable $exception): array
    {
        $entry['status'] = 'failed';
        $entry['verification_status'] = 'failed';
        $entry['verification_error'] = 'This backup could not be verified and is not protected.';
        $this->replaceHistoryEntry($entry);
        Log::error('Backup file verification failed.', [
            'filename' => $entry['filename'] ?? null,
            'exception' => $exception,
        ]);

        try {
            $alreadyNotified = Schema::hasTable('notifications')
                && AdminNotification::query()
                    ->where('type', 'system_alert')
                    ->where('title', 'Backup verification failed')
                    ->get(['data'])
                    ->contains(static fn (AdminNotification $notification): bool => ($notification->data['filename'] ?? null) === ($entry['filename'] ?? null));
            if (! $alreadyNotified) {
                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'system_alert',
                    'title' => 'Backup verification failed',
                    'message' => 'A saved backup could not be verified. It is not marked as protected. Please contact technical support.',
                    'data' => ['filename' => $entry['filename'] ?? null],
                    'action_url' => '/admin/backups',
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }
        } catch (Throwable $notificationException) {
            Log::critical('Administrators could not be notified about a failed backup verification.', [
                'filename' => $entry['filename'] ?? null,
                'exception' => $notificationException,
            ]);
        }

        return $entry;
    }

    private function storageStatus(string $path): array
    {
        $freeBytes = @disk_free_space($path);
        if (! is_float($freeBytes) && ! is_int($freeBytes)) {
            return ['status' => 'unknown', 'free_bytes' => null];
        }

        $freeBytes = (int) $freeBytes;
        $minimumFreeBytes = (int) config('backup.minimum_free_bytes', 104857600);

        return [
            'status' => $freeBytes >= $minimumFreeBytes ? 'healthy' : 'low',
            'free_bytes' => $freeBytes,
        ];
    }

    private function healthStatus(
        string $scheduleTime,
        ?array $lastVerifiedBackup,
        ?array $lastVerifiedScheduledBackup,
        ?array $lastScheduledBackup,
        ?array $latestBackup,
        array $storage,
        array $scheduler
    ): array {
        $timezone = 'Asia/Manila';
        if (! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $scheduleTime)) {
            $scheduleTime = '02:00';
        }
        $now = now($timezone);
        [$hour, $minute] = array_map('intval', explode(':', $scheduleTime));
        $todaySchedule = $now->copy()->setTime($hour, $minute, 0);
        $nextSchedule = $todaySchedule->isFuture() ? $todaySchedule : $todaySchedule->copy()->addDay();
        $coveredSince = $todaySchedule->isFuture() ? $todaySchedule->copy()->subDay() : $todaySchedule;
        $scheduledAt = $lastVerifiedScheduledBackup ? \Illuminate\Support\Carbon::parse($lastVerifiedScheduledBackup['created_at'], $timezone) : null;
        $hasCurrentScheduledBackup = $scheduledAt && $scheduledAt->greaterThanOrEqualTo($coveredSince);
        $verificationStatus = $latestBackup['verification_status'] ?? 'unverified';
        $latestStatus = $latestBackup['status'] ?? 'none';
        $scheduledStatus = $lastScheduledBackup['status'] ?? 'none';

        if (! $lastVerifiedBackup) {
            $status = 'not_protected';
            $message = 'No verified backup copy is available yet.';
        } elseif ($scheduler['status'] !== 'active') {
            $status = 'needs_attention';
            $message = 'The automatic backup schedule is not responding. Please ask the hosting administrator to check the scheduled task.';
        } elseif ($storage['status'] !== 'healthy') {
            $status = 'needs_attention';
            $message = $storage['status'] === 'low'
                ? 'Backup storage is running low. Please contact technical support.'
                : 'Backup storage could not be checked. Please contact technical support.';
        } elseif (! $hasCurrentScheduledBackup || $scheduledStatus === 'failed' || $verificationStatus !== 'verified') {
            $status = 'needs_attention';
            $message = $now->greaterThanOrEqualTo($todaySchedule) && ! $hasCurrentScheduledBackup
                ? "Today's scheduled backup is late. Automatic retries are running."
                : 'The latest daily backup needs attention.';
        } else {
            $status = 'protected';
            $message = 'Your data is safely backed up.';
        }

        return [
            'status' => $status,
            'message' => $message,
            'last_successful_backup' => $lastVerifiedBackup,
            'next_scheduled_at' => $nextSchedule->toIso8601String(),
            'latest_backup_status' => $latestStatus,
            'file_verification_status' => $verificationStatus,
            'storage_status' => $storage,
            'scheduler_status' => $scheduler,
            'schedule_overdue' => $now->greaterThanOrEqualTo($todaySchedule) && ! $hasCurrentScheduledBackup,
        ];
    }

    private function schedulerStatus($disk): array
    {
        if (! $disk->exists(self::SCHEDULER_HEARTBEAT)) {
            return ['status' => 'inactive', 'last_seen_at' => null];
        }

        try {
            $heartbeat = json_decode($disk->get(self::SCHEDULER_HEARTBEAT), true, 512, JSON_THROW_ON_ERROR);
            $lastSeen = isset($heartbeat['last_seen_at']) ? \Illuminate\Support\Carbon::parse($heartbeat['last_seen_at']) : null;
            if (! $lastSeen) {
                return ['status' => 'inactive', 'last_seen_at' => null];
            }

            return [
                'status' => $lastSeen->greaterThanOrEqualTo(now()->subMinutes(3)) ? 'active' : 'inactive',
                'last_seen_at' => $lastSeen->toIso8601String(),
            ];
        } catch (Throwable $exception) {
            Log::warning('Backup scheduler heartbeat could not be read.', ['exception' => $exception]);

            return ['status' => 'inactive', 'last_seen_at' => null];
        }
    }

    private function sameDatabase(array $left, array $right): bool
    {
        $leftDriver = strtolower((string) ($left['driver'] ?? ''));
        $rightDriver = strtolower((string) ($right['driver'] ?? ''));
        $leftDriver = $leftDriver === 'mariadb' ? 'mysql' : $leftDriver;
        $rightDriver = $rightDriver === 'mariadb' ? 'mysql' : $rightDriver;
        if ($leftDriver !== $rightDriver) {
            return false;
        }
        if ($leftDriver === 'sqlite') {
            $leftDatabase = (string) ($left['database'] ?? '');
            $rightDatabase = (string) ($right['database'] ?? '');
            if ($leftDatabase === ':memory:' || $rightDatabase === ':memory:') {
                return $leftDatabase === $rightDatabase;
            }

            $leftPath = realpath($leftDatabase) ?: $leftDatabase;
            $rightPath = realpath($rightDatabase) ?: $rightDatabase;

            return strcasecmp($leftPath, $rightPath) === 0;
        }

        return strtolower((string) ($left['database'] ?? '')) === strtolower((string) ($right['database'] ?? ''));
    }

    private function findEntry(string $filename): array
    {
        if (! preg_match('/^pastry-project-db-\d{8}-\d{6}-[a-z0-9]{6}\.sql$/', $filename)) {
            throw new \InvalidArgumentException('Backup file not found.');
        }

        foreach ($this->readHistory() as $entry) {
            if (($entry['filename'] ?? null) === $filename) {
                return $entry;
            }
        }

        throw new \InvalidArgumentException('Backup file not found.');
    }

    private function readHistory(): array
    {
        $disk = Storage::disk('local');
        if (! $disk->exists(self::HISTORY_FILE)) {
            return [];
        }

        try {
            $history = json_decode($disk->get(self::HISTORY_FILE), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            Log::error('Database backup history could not be read.', ['exception' => $exception]);

            return [];
        }

        return is_array($history) ? array_values(array_filter($history, 'is_array')) : [];
    }

    private function replaceHistoryEntry(array $updatedEntry): void
    {
        $history = $this->readHistory();
        $found = false;
        foreach ($history as $index => $entry) {
            if (($entry['filename'] ?? null) === $updatedEntry['filename']) {
                $history[$index] = $updatedEntry;
                $found = true;
                break;
            }
        }
        if (! $found) {
            array_unshift($history, $updatedEntry);
        }

        $this->writeHistory($history);
    }

    private function writeHistory(array $history): void
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        $contents = json_encode(array_values($history), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $written = file_put_contents($disk->path(self::HISTORY_FILE), $contents, LOCK_EX);
        if ($written === false) {
            throw new RuntimeException('Backup history could not be saved.');
        }
        @chmod($disk->path(self::HISTORY_FILE), 0600);
    }
}