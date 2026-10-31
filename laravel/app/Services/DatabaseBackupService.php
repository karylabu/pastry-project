<?php

namespace App\Services;

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
    private const FORMAT_HEADER = '-- pastry-project-sql-backup:v1';

    public function overview(): array
    {
        $disk = Storage::disk('local');
        $files = array_values(array_filter(
            $disk->files(self::DIRECTORY),
            static fn (string $path): bool => str_ends_with(strtolower($path), '.sql')
        ));
        $storageUsed = array_sum(array_map(static fn (string $path): int => (int) $disk->size($path), $files));
        $items = $this->readHistory();

        foreach ($items as &$item) {
            $path = self::DIRECTORY . '/' . $item['filename'];
            if (($item['status'] ?? '') === 'successful' && ! $disk->exists($path)) {
                $item['status'] = 'failed';
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

        return [
            'backups' => array_values($items),
            'overview' => [
                'last_backup' => $items[0] ?? null,
                'total_backups' => count($files),
                'storage_used_bytes' => $storageUsed,
            ],
        ];
    }

    public function create(string $type = 'manual'): array
    {
        if (! in_array($type, ['manual', 'automatic'], true)) {
            throw new RuntimeException('Invalid backup type.');
        }

        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
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
            if (! @rename($temporaryPath, $backupPath)) {
                throw new RuntimeException('Unable to publish the completed backup file.');
            }
            @chmod($backupPath, 0600);

            $entry['status'] = 'successful';
            $entry['size_bytes'] = (int) filesize($backupPath);
            $this->replaceHistoryEntry($entry);

            return $entry;
        } catch (Throwable $exception) {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }

            $entry['status'] = 'failed';
            $this->replaceHistoryEntry($entry);
            Log::error('Database SQL backup failed.', ['filename' => $filename, 'exception' => $exception]);

            throw new RuntimeException('The database backup could not be completed.', 0, $exception);
        }
    }

    public function downloadPath(string $filename): string
    {
        $entry = $this->findEntry($filename);
        $path = Storage::disk('local')->path(self::DIRECTORY . '/' . $entry['filename']);

        if (($entry['status'] ?? '') !== 'successful' || ! is_file($path)) {
            throw new \InvalidArgumentException('Backup file not found.');
        }

        return $path;
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
        if (($entry['status'] ?? '') !== 'successful') {
            throw new \InvalidArgumentException('Backup file not found.');
        }

        $backupPath = $this->downloadPath($filename);
        $safetyBackup = $this->create('automatic');
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
            if (! fflush($handle)) {
                throw new RuntimeException('Unable to finish writing the backup file.');
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

    private function applyDump(string $path): void
    {
        $contents = @file_get_contents($path);
        if (! is_string($contents) || ! str_starts_with($contents, self::FORMAT_HEADER . "\n")) {
            throw new RuntimeException('The selected file is not a supported Pastry Project SQL backup.');
        }

        $driver = $this->supportedDriver();
        if (! preg_match('/^-- driver:([a-z]+)$/m', $contents, $matches) || $matches[1] !== $driver) {
            throw new RuntimeException('This backup was created for a different database driver.');
        }

        $connection = DB::connection();
        $pdo = $connection->getPdo();
        $this->setForeignKeys($pdo, $driver, false);

        try {
            foreach ($this->tableNames($driver) as $table) {
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

    private function tableNames(string $driver): array
    {
        $connection = DB::connection();
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

    private function supportedDriver(): string
    {
        $driver = strtolower((string) DB::connection()->getDriverName());
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
    }
}