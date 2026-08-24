<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LegacyController extends Controller
{
    protected string $root;

    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $this->root = realpath(base_path('../')) ?: base_path('../');
    }

    public function render(Request $request)
    {
        $relativePath = ltrim($request->path(), '/');
        $filePath = realpath($this->root . DIRECTORY_SEPARATOR . $relativePath);

        if (!$filePath || !str_starts_with($filePath, $this->root . DIRECTORY_SEPARATOR)) {
            abort(404);
        }

        if (!str_ends_with($filePath, '.php')) {
            abort(404);
        }

        if (str_contains($filePath, DIRECTORY_SEPARATOR . 'laravel' . DIRECTORY_SEPARATOR) || str_contains($filePath, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR)) {
            abort(404);
        }

        if (!file_exists($filePath) || !is_file($filePath)) {
            abort(404);
        }

        $cwd = getcwd();
        chdir($this->root);

        // provide legacy compatibility functions (db(), db_all(), db_run(), etc.)
        $compat = base_path('legacy_compat.php');
        if (file_exists($compat)) {
            include_once $compat;
        }

        ob_start();
        include $filePath;
        $content = ob_get_clean();

        chdir($cwd);

        return response($content);
    }
}
