<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;
use ZipArchive;

class FullSystemBackupService
{
    private const DIRECTORY = 'backups/system';
    private const HISTORY_FILE = 'backups/system/history.json';
    private const INCLUDED_PATHS = [
        '.htaccess',
        'index.php',
        'customer_index.php',
        'logo.jpg',
        'admin',
        'customer',
        'staff',
        'includes',
        'uploads',
        'customer_portal/build',
        'laravel/app',
        'laravel/bootstrap',
        'laravel/config',
        'laravel/database',
        'laravel/public',
        'laravel/resources',
        'laravel/routes',
        'laravel/vendor',
        'laravel/artisan',
        'laravel/composer.json',
        'laravel/composer.lock',
    ];

    public function overview(): array
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        $entries = $this->readHistory();

        foreach ($entries as &$entry) {
            $filename = (string) ($entry['filename'] ?? '');
            if (! preg_match('/^pastry-project-system-[A-Za-z0-9._-]+\.zip$/D', $filename)) {
                $entry['status'] = 'failed';
                $entry['verification_status'] = 'failed';
                $entry['size_bytes'] = 0;
                continue;
            }
            $path = self::DIRECTORY . '/' . $filename;
            if (($entry['status'] ?? null) === 'successful'
                && (! $disk->exists($path) || (int) $disk->size($path) <= 0)) {
                $entry['status'] = 'failed';
                $entry['verification_status'] = 'failed';
            } elseif ($disk->exists($path)) {
                $entry['size_bytes'] = (int) $disk->size($path);
            }
        }
        unset($entry);

        usort($entries, static fn (array $left, array $right): int => strcmp(
            (string) ($right['created_at'] ?? ''),
            (string) ($left['created_at'] ?? '')
        ));

        $successful = array_values(array_filter($entries, static fn (array $entry): bool =>
            ($entry['status'] ?? null) === 'successful'
            && ($entry['verification_status'] ?? null) === 'verified'
        ));
        $latestScheduled = collect($entries)->first(static fn (array $entry): bool =>
            ($entry['purpose'] ?? null) === 'scheduled'
        );

        return [
            'backups' => array_values($entries),
            'overview' => [
                'last_backup' => $entries[0] ?? null,
                'last_successful_backup' => $successful[0] ?? null,
                'last_scheduled_backup' => $latestScheduled,
                'available_backups' => count($successful),
                'total_backups' => count($entries),
                'storage_used_bytes' => array_sum(array_map(
                    static fn (array $entry): int => (int) ($entry['size_bytes'] ?? 0),
                    $entries
                )),
            ],
        ];
    }

    public function create(string $purpose, array $databaseBackup, ?string $siteRoot = null): array
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }
        if (! in_array($purpose, ['manual', 'scheduled'], true)) {
            throw new RuntimeException('Invalid system backup purpose.');
        }
        $databaseFilename = (string) ($databaseBackup['filename'] ?? '');
        $databasePath = app(DatabaseBackupService::class)->downloadPath($databaseFilename);
        $root = rtrim($siteRoot ?? base_path('..'), DIRECTORY_SEPARATOR);
        if (! is_dir($root)) {
            throw new RuntimeException('The website files directory could not be found.');
        }

        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        $directory = $disk->path(self::DIRECTORY);
        @chmod($directory, 0700);
        $lock = @fopen($directory . DIRECTORY_SEPARATOR . 'system.lock', 'c');
        if (! is_resource($lock)) {
            throw new RuntimeException('The system backup lock could not be opened.');
        }
        @chmod($directory . DIRECTORY_SEPARATOR . 'system.lock', 0600);

        if (! flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            throw new RuntimeException('Another system backup is already running. Please try again shortly.');
        }

        $createdAt = now();
        $filename = sprintf(
            'pastry-project-system-%s-%s.zip',
            $createdAt->format('Ymd-His'),
            Str::lower(Str::random(6))
        );
        $temporaryPath = $directory . DIRECTORY_SEPARATOR . '.' . $filename . '.tmp';
        $backupPath = $directory . DIRECTORY_SEPARATOR . $filename;
        $entry = [
            'id' => $filename,
            'filename' => $filename,
            'created_at' => $createdAt->toIso8601String(),
            'type' => $purpose === 'scheduled' ? 'automatic' : 'manual',
            'purpose' => $purpose,
            'status' => 'in_progress',
            'verification_status' => 'unverified',
            'size_bytes' => 0,
        ];
        try {
            $history = $this->readHistory();
            array_unshift($history, $entry);
            $this->writeHistory($history);

            if (! class_exists(ZipArchive::class)) {
                throw new RuntimeException('ZIP support is unavailable on this server. Enable the PHP ZIP extension and try again.');
            }

            $files = $this->collectFiles($root);
            $manifestEntries = [];
            $zip = new ZipArchive();
            if ($zip->open($temporaryPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('Unable to create the system backup ZIP file.');
            }

            try {
                foreach ($files as $file) {
                    $size = @filesize($file['absolute_path']);
                    $handle = @fopen($file['absolute_path'], 'rb');
                    if (! is_resource($handle)) {
                        throw new RuntimeException('A deployed website file could not be read for the system backup.');
                    }
                    fclose($handle);
                    $hash = @hash_file('sha256', $file['absolute_path']);
                    if (! is_int($size) || ! is_string($hash)) {
                        throw new RuntimeException('A website file could not be verified for the system backup: ' . $file['archive_path']);
                    }
                    if (! $zip->addFile($file['absolute_path'], $file['archive_path'])) {
                        throw new RuntimeException('A website file could not be added to the system backup.');
                    }
                    $manifestEntries[] = [
                        'path' => $file['archive_path'],
                        'size_bytes' => $size,
                        'sha256' => $hash,
                    ];
                }

                if (! $zip->addFile($databasePath, 'database/' . $databaseFilename)) {
                    throw new RuntimeException('The verified database backup could not be added to the system ZIP.');
                }
                $databaseSize = @filesize($databasePath);
                $databaseHash = @hash_file('sha256', $databasePath);
                if (! is_int($databaseSize) || ! is_string($databaseHash)) {
                    throw new RuntimeException('The database backup could not be verified for the system ZIP.');
                }
                $manifestEntries[] = [
                    'path' => 'database/' . $databaseFilename,
                    'size_bytes' => $databaseSize,
                    'sha256' => $databaseHash,
                ];
                $manifest = [
                    'format' => 'pastry-project-full-system-backup',
                    'version' => 1,
                    'created_at' => $createdAt->toIso8601String(),
                    'files' => $manifestEntries,
                    'excluded' => [
                        '.env files and runtime secrets',
                        'database and mailer credential files',
                        'Laravel storage logs, caches, sessions, and existing backups',
                        'development dependencies, source-control data, and local build artifacts',
                    ],
                ];
                if (! $zip->addFromString(
                    'SYSTEM-BACKUP-MANIFEST.json',
                    json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
                )) {
                    throw new RuntimeException('The system backup manifest could not be written.');
                }
                if (! $zip->addFromString('RESTORE-GUIDE.txt', $this->restoreGuide())) {
                    throw new RuntimeException('The restore guide could not be written.');
                }
            } finally {
                if (! @$zip->close()) {
                    throw new RuntimeException('The system backup ZIP could not be finalized: ' . $zip->getStatusString());
                }
            }

            $this->verifyArchive($temporaryPath, $manifestEntries);

            if (! @rename($temporaryPath, $backupPath)) {
                throw new RuntimeException('Unable to publish the completed system backup.');
            }
            @chmod($backupPath, 0600);
            $size = filesize($backupPath);
            $hash = hash_file('sha256', $backupPath);
            if (! is_int($size) || $size <= 0 || ! is_string($hash)) {
                throw new RuntimeException('The completed system backup could not be verified.');
            }

            $entry['status'] = 'successful';
            $entry['verification_status'] = 'verified';
            $entry['size_bytes'] = $size;
            $entry['sha256'] = $hash;
            $this->replaceHistoryEntry($entry);

            return $entry;
        } catch (Throwable $exception) {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
            if (is_file($backupPath)) {
                @unlink($backupPath);
            }
            $entry['status'] = 'failed';
            $entry['verification_status'] = 'failed';
            $entry['verification_error'] = 'The system backup could not be completed.';
            try {
                $this->replaceHistoryEntry($entry);
            } catch (Throwable $historyException) {
                Log::critical('Failed system backup status could not be saved.', [
                    'filename' => $filename,
                    'exception' => $historyException,
                ]);
            }
            Log::error('Full system backup creation failed.', [
                'filename' => $filename,
                'exception' => $exception,
            ]);

            throw $exception;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function downloadPath(string $filename): string
    {
        $entry = $this->findEntry($filename);
        $path = Storage::disk('local')->path(self::DIRECTORY . '/' . $entry['filename']);
        if (($entry['status'] ?? null) !== 'successful'
            || ($entry['verification_status'] ?? null) !== 'verified'
            || ! is_file($path)
            || ! is_readable($path)
            || (int) @filesize($path) <= 0
            || empty($entry['sha256'])) {
            throw new RuntimeException('This system backup is missing or failed its integrity check.');
        }
        $actualHash = @hash_file('sha256', $path);
        if (! is_string($actualHash) || ! hash_equals((string) $entry['sha256'], $actualHash)) {
            throw new RuntimeException('This system backup is missing or failed its integrity check.');
        }

        return $path;
    }

    public function delete(string $filename): void
    {
        $entry = $this->findEntry($filename);
        $disk = Storage::disk('local');
        $path = self::DIRECTORY . '/' . $entry['filename'];
        if ($disk->exists($path) && ! $disk->delete($path)) {
            throw new RuntimeException('The system backup file could not be deleted.');
        }

        $history = array_values(array_filter(
            $this->readHistory(),
            static fn (array $item): bool => ($item['filename'] ?? null) !== $filename
        ));
        $this->writeHistory($history);
    }

    public function successfulScheduledBackupOn(string $date): ?array
    {
        foreach ($this->readHistory() as $entry) {
            if (($entry['purpose'] ?? null) === 'scheduled'
                && ($entry['status'] ?? null) === 'successful'
                && ($entry['verification_status'] ?? null) === 'verified'
                && str_starts_with((string) ($entry['created_at'] ?? ''), $date)) {
                $filename = (string) ($entry['filename'] ?? '');
                if (! preg_match('/^pastry-project-system-[A-Za-z0-9._-]+\.zip$/D', $filename)) {
                    continue;
                }
                $path = self::DIRECTORY . '/' . $filename;
                if (Storage::disk('local')->exists($path)
                    && (int) Storage::disk('local')->size($path) > 0) {
                    return $entry;
                }
            }
        }

        return null;
    }

    public function latestScheduledBackupOn(string $date): ?array
    {
        foreach ($this->readHistory() as $entry) {
            if (($entry['purpose'] ?? null) === 'scheduled'
                && str_starts_with((string) ($entry['created_at'] ?? ''), $date)) {
                return $entry;
            }
        }

        return null;
    }

    private function collectFiles(string $root): array
    {
        $files = [];
        foreach (self::INCLUDED_PATHS as $relativePath) {
            $absolutePath = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
            if (is_file($absolutePath) && ! is_link($absolutePath)) {
                if (! $this->isExcluded($relativePath)) {
                    $files[] = ['absolute_path' => $absolutePath, 'archive_path' => $relativePath];
                }
                continue;
            }
            if (! is_dir($absolutePath) || is_link($absolutePath)) {
                continue;
            }

            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($absolutePath, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY
            );
            foreach ($iterator as $item) {
                if (! $item->isFile() || $item->isLink()) {
                    continue;
                }
                $path = str_replace('\\', '/', substr($item->getPathname(), strlen($root) + 1));
                if ($this->isExcluded($path)) {
                    continue;
                }
                $files[] = [
                    'absolute_path' => $item->getPathname(),
                    'archive_path' => $path,
                ];
            }
        }

        usort($files, static fn (array $left, array $right): int => strcmp($left['archive_path'], $right['archive_path']));
        if ($files === []) {
            throw new RuntimeException('No website files were found to include in the system backup.');
        }

        return $files;
    }

    private function isExcluded(string $relativePath): bool
    {
        $path = strtolower(str_replace('\\', '/', $relativePath));
        $filename = basename($path);

        return $filename === '.env'
            || str_starts_with($filename, '.env.')
            || in_array($filename, ['db.php', 'mailer.php', 'credentials.json', 'secrets.json'], true)
            || in_array(pathinfo($filename, PATHINFO_EXTENSION), ['key', 'pem', 'p12', 'pfx'], true)
            || str_starts_with($path, 'laravel/bootstrap/cache/')
            || preg_match('~(^|/)(?:\.git|node_modules|storage|backups)(?:/|$)~', $path) === 1;
    }

    private function restoreGuide(): string
    {
        return "Pastry Project system backup\n\n"
            . "This ZIP contains a verified database SQL backup, deployed website/app files, uploaded files, and a manifest with SHA-256 checksums.\n\n"
            . "Restore this package manually through Hostinger or with your technical administrator. Restore the website files and database from the same package together, then restore hosting configuration from your secure hosting records. This package intentionally excludes .env files, database credentials, mailer credentials, logs, caches, sessions, and existing backup archives. Never upload this ZIP into a public website folder.\n";
    }

    private function verifyArchive(string $path, array $entries): void
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CHECKCONS) !== true) {
            throw new RuntimeException('The system backup ZIP did not pass archive validation.');
        }

        try {
            foreach ($entries as $entry) {
                $stream = @$zip->getStream($entry['path']);
                if (! is_resource($stream)) {
                    throw new RuntimeException('A file could not be verified inside the system backup ZIP.');
                }
                $context = hash_init('sha256');
                $size = 0;
                try {
                    while (! feof($stream)) {
                        $chunk = fread($stream, 1024 * 1024);
                        if ($chunk === false) {
                            throw new RuntimeException('The system backup ZIP could not be fully read for verification.');
                        }
                        $size += strlen($chunk);
                        hash_update($context, $chunk);
                    }
                } finally {
                    fclose($stream);
                }

                if ($size !== (int) $entry['size_bytes']
                    || ! hash_equals((string) $entry['sha256'], hash_final($context))) {
                    throw new RuntimeException('A file in the system backup ZIP failed its integrity check.');
                }
            }
        } finally {
            $zip->close();
        }
    }

    private function findEntry(string $filename): array
    {
        if (! preg_match('/^pastry-project-system-[A-Za-z0-9._-]+\.zip$/D', $filename)) {
            throw new \InvalidArgumentException('System backup file not found.');
        }
        foreach ($this->readHistory() as $entry) {
            if (($entry['filename'] ?? null) === $filename) {
                return $entry;
            }
        }

        throw new \InvalidArgumentException('System backup file not found.');
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
            Log::error('System backup history could not be read.', ['exception' => $exception]);
            throw new RuntimeException('System backup history could not be read.', 0, $exception);
        }
        if (! is_array($history)) {
            throw new RuntimeException('System backup history has an invalid format.');
        }

        return array_values(array_filter($history, 'is_array'));
    }

    private function replaceHistoryEntry(array $updatedEntry): void
    {
        $history = array_values(array_filter(
            $this->readHistory(),
            static fn (array $entry): bool => ($entry['filename'] ?? null) !== $updatedEntry['filename']
        ));
        array_unshift($history, $updatedEntry);
        $this->writeHistory($history);
    }

    private function writeHistory(array $history): void
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIRECTORY);
        $contents = json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (file_put_contents($disk->path(self::HISTORY_FILE), $contents, LOCK_EX) === false) {
            throw new RuntimeException('System backup history could not be saved.');
        }
        @chmod($disk->path(self::HISTORY_FILE), 0600);
    }
}
