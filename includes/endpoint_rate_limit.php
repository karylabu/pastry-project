<?php

function pastryRateLimitPrune(string $directory): void
{
    $cleanupPath = $directory . DIRECTORY_SEPARATOR . '.cleanup';
    if (is_file($cleanupPath) && filemtime($cleanupPath) >= time() - 3600) {
        return;
    }

    $handle = fopen($cleanupPath, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('Rate limiting storage is unavailable.');
    }

    try {
        $lastCleanup = (int) trim((string) stream_get_contents($handle));
        $now = time();
        if ($now - $lastCleanup < 3600) {
            return;
        }

        foreach (new DirectoryIterator($directory) as $entry) {
            if ($entry->isFile() && $entry->getFilename() !== '.cleanup'
                && $entry->getMTime() < $now - 86400) {
                unlink($entry->getPathname());
            }
        }

        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, (string) $now) === false || !fflush($handle)) {
            throw new RuntimeException('Rate limiting storage is unavailable.');
        }
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function pastryRateLimitConsume(string $scope, string $identity, int $limit, int $windowSeconds): int
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'pastry-project-rate-limits';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Rate limiting storage is unavailable.');
    }

    pastryRateLimitPrune($directory);

    $path = $directory . DIRECTORY_SEPARATOR
        . hash('sha256', $scope . "\0" . strtolower(trim($identity))) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('Rate limiting storage is unavailable.');
    }

    try {
        $contents = stream_get_contents($handle);
        $state = is_string($contents) ? json_decode($contents, true) : null;
        $now = time();
        if (!is_array($state) || (int) ($state['expires_at'] ?? 0) <= $now) {
            $state = ['count' => 0, 'expires_at' => $now + $windowSeconds];
        }

        $retryAfter = max(0, (int) $state['expires_at'] - $now);
        if ((int) $state['count'] >= $limit) {
            return max(1, $retryAfter);
        }

        $state['count'] = (int) $state['count'] + 1;
        rewind($handle);
        $encoded = json_encode($state);
        if (!is_string($encoded) || !ftruncate($handle, 0)
            || fwrite($handle, $encoded) !== strlen($encoded) || !fflush($handle)) {
            throw new RuntimeException('Rate limiting storage is unavailable.');
        }

        return 0;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
