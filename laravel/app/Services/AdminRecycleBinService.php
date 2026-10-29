<?php

namespace App\Services;

use App\Jobs\ProcessSalesCsvImport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class AdminRecycleBinService
{
    private const RETENTION_DAYS = 30;

    public function trashPromotion(int $promotionId): void
    {
        DB::transaction(function () use ($promotionId): void {
            $promotion = DB::table('promotions')->where('id', $promotionId)->lockForUpdate()->first();
            if (! $promotion) {
                throw new RuntimeException('Promotion not found.');
            }

            $payload = [
                'promotion' => (array) $promotion,
                'email_logs' => Schema::hasTable('promotion_email_logs')
                    ? DB::table('promotion_email_logs')->where('promotion_id', $promotionId)->get()->map(fn ($row) => (array) $row)->all()
                    : [],
            ];
            $this->createEntry('promotion', (string) $promotion->title, $payload);
            DB::table('promotions')->where('id', $promotionId)->delete();
        });
    }

    public function trashImport(int $importId): void
    {
        DB::transaction(function () use ($importId): void {
            $import = DB::table('analytics_imports')->where('id', $importId)->lockForUpdate()->first();
            if (! $import) {
                throw new RuntimeException('Import not found.');
            }

            $history = DB::table('analytics_sales_history')->where('import_id', $importId)->get()
                ->map(fn ($row) => (array) $row)->all();
            $this->createEntry('csv_import', (string) ($import->file_name ?: "CSV import #{$importId}"), [
                'import' => (array) $import,
                'sales_history' => $history,
            ]);
            DB::table('analytics_sales_history')->where('import_id', $importId)->delete();
            DB::table('analytics_imports')->where('id', $importId)->delete();
        });
    }

    public function trashCustomizedRecipe(int $recipeId): void
    {
        DB::transaction(function () use ($recipeId): void {
            $recipe = DB::table('cake_recipes')->where('id', $recipeId)->lockForUpdate()->first();
            if (! $recipe) {
                throw new RuntimeException('Recipe not found.');
            }

            $ingredients = DB::table('cake_recipe_ingredients')->where('recipe_id', $recipeId)->get()
                ->map(fn ($row) => (array) $row)->all();
            $flavor = Schema::hasTable('cake_flavors')
                ? DB::table('cake_flavors')->where('id', $recipe->flavor_id)->value('name')
                : null;
            $this->createEntry('customized_recipe', (string) ($flavor ?: "Customized cake recipe #{$recipeId}"), [
                'recipe' => (array) $recipe,
                'ingredients' => $ingredients,
            ]);
            DB::table('cake_recipe_ingredients')->where('recipe_id', $recipeId)->delete();
            DB::table('cake_recipes')->where('id', $recipeId)->delete();
        });
    }

    public function trashProductRecipe(int $productId, int $productSizeId): void
    {
        DB::transaction(function () use ($productId, $productSizeId): void {
            $rows = DB::table('product_recipes')
                ->where('product_id', $productId)
                ->where('product_size_id', $productSizeId)
                ->lockForUpdate()
                ->get()->map(fn ($row) => (array) $row)->all();
            if (! $rows) {
                throw new RuntimeException('Product recipe not found.');
            }

            $productName = DB::table('products')->where('id', $productId)->value('name');
            $this->createEntry('product_recipe', trim(($productName ?: "Product #{$productId}") . ' recipe · size #' . $productSizeId), [
                'rows' => $rows,
            ]);
            DB::table('product_recipes')
                ->where('product_id', $productId)
                ->where('product_size_id', $productSizeId)
                ->delete();
        });
    }

    public function entries(): array
    {
        $this->purgeExpired();

        return DB::table('admin_recycle_bin')->orderByDesc('deleted_at')->get()
            ->map(static fn ($entry) => [
                'id' => (int) $entry->id,
                'type' => $entry->item_type,
                'label' => $entry->label,
                'deleted_at' => $entry->deleted_at,
                'expires_at' => $entry->expires_at,
            ])->all();
    }

    public function restore(int $entryId): void
    {
        $this->purgeExpired();
        DB::transaction(function () use ($entryId): void {
            $entry = DB::table('admin_recycle_bin')->where('id', $entryId)->lockForUpdate()->first();
            if (! $entry) {
                throw new RuntimeException('Recycle Bin entry not found or expired.');
            }

            $payload = json_decode((string) $entry->payload, true, 512, JSON_THROW_ON_ERROR);
            switch ($entry->item_type) {
                case 'promotion':
                    $this->insertSnapshot('promotions', $payload['promotion']);
                    foreach ($payload['email_logs'] ?? [] as $row) {
                        if (Schema::hasTable('promotion_email_logs')) {
                            $this->insertSnapshot('promotion_email_logs', $row);
                        }
                    }
                    break;
                case 'csv_import':
                    $this->insertSnapshot('analytics_imports', $payload['import']);
                    foreach ($payload['sales_history'] ?? [] as $row) {
                        $this->insertSnapshot('analytics_sales_history', $row);
                    }
                    if (($payload['import']['status'] ?? null) === 'queued') {
                        $storedPath = $payload['import']['stored_path'] ?? null;
                        if (! $storedPath || ! Storage::disk('local')->exists($storedPath)) {
                            throw new RuntimeException('The queued CSV file is unavailable and cannot be restored for processing.');
                        }

                        $queueJobId = Queue::connection('database')->pushOn(
                            (string) config('queue.connections.database.queue', 'default'),
                            new ProcessSalesCsvImport((int) $payload['import']['id'], (string) $storedPath),
                        );
                        if (Schema::hasColumn('analytics_imports', 'queue_job_id')) {
                            DB::table('analytics_imports')
                                ->where('id', $payload['import']['id'])
                                ->update(['queue_job_id' => $queueJobId]);
                        }
                    }
                    break;
                case 'customized_recipe':
                    $this->insertSnapshot('cake_recipes', $payload['recipe']);
                    foreach ($payload['ingredients'] ?? [] as $row) {
                        $this->insertSnapshot('cake_recipe_ingredients', $row);
                    }
                    break;
                case 'product_recipe':
                    foreach ($payload['rows'] ?? [] as $row) {
                        $this->insertSnapshot('product_recipes', $row);
                    }
                    break;
                default:
                    throw new RuntimeException('This Recycle Bin item type cannot be restored.');
            }

            DB::table('admin_recycle_bin')->where('id', $entryId)->delete();
        });
    }

    public function permanentlyDelete(int $entryId): void
    {
        $this->purgeExpired();
        $entry = DB::table('admin_recycle_bin')->where('id', $entryId)->first();
        if (! $entry) {
            throw new RuntimeException('Recycle Bin entry not found or expired.');
        }

        $payload = json_decode((string) $entry->payload, true, 512, JSON_THROW_ON_ERROR);
        if ($entry->item_type === 'csv_import') {
            $path = $payload['import']['stored_path'] ?? null;
            if ($path && Storage::disk('local')->exists($path) && ! Storage::disk('local')->delete($path)) {
                throw new RuntimeException('Unable to permanently remove the stored CSV file.');
            }
        } elseif ($entry->item_type === 'promotion') {
            $this->deletePromotionImage($payload['promotion']['image_url'] ?? null);
        }
        DB::table('admin_recycle_bin')->where('id', $entryId)->delete();
    }

    private function createEntry(string $type, string $label, array $payload): void
    {
        $this->purgeExpired();
        $now = now();
        DB::table('admin_recycle_bin')->insert([
            'item_type' => $type,
            'label' => $label,
            'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
            'deleted_at' => $now,
            'expires_at' => $now->copy()->addDays(self::RETENTION_DAYS),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function insertSnapshot(string $table, array $row): void
    {
        if (! Schema::hasTable($table)) {
            throw new RuntimeException("Cannot restore this item because {$table} is unavailable.");
        }

        $availableColumns = array_flip(Schema::getColumnListing($table));
        $safeRow = array_intersect_key($row, $availableColumns);
        if (isset($safeRow['id']) && DB::table($table)->where('id', $safeRow['id'])->exists()) {
            throw new RuntimeException('Restore conflict: a record with this ID already exists.');
        }
        DB::table($table)->insert($safeRow);
    }

    private function purgeExpired(): void
    {
        if (! Schema::hasTable('admin_recycle_bin')) {
            return;
        }

        $expired = DB::table('admin_recycle_bin')->where('expires_at', '<=', now())->get();
        foreach ($expired as $entry) {
            if ($entry->item_type === 'csv_import') {
                $payload = json_decode((string) $entry->payload, true);
                $path = is_array($payload) ? ($payload['import']['stored_path'] ?? null) : null;
                if ($path && Storage::disk('local')->exists($path) && ! Storage::disk('local')->delete($path)) {
                    throw new RuntimeException('Unable to purge an expired CSV import file.');
                }
            } elseif ($entry->item_type === 'promotion') {
                $payload = json_decode((string) $entry->payload, true);
                $this->deletePromotionImage(is_array($payload) ? ($payload['promotion']['image_url'] ?? null) : null);
            }
            DB::table('admin_recycle_bin')->where('id', $entry->id)->delete();
        }
    }

    private function deletePromotionImage(?string $imageUrl): void
    {
        $path = parse_url((string) $imageUrl, PHP_URL_PATH);
        if (! is_string($path) || ! preg_match('~^/?uploads/promotions/[A-Za-z0-9._-]+$~D', $path)) {
            return;
        }

        $imagePath = public_path(ltrim($path, '/'));
        if (File::exists($imagePath) && ! File::delete($imagePath)) {
            throw new RuntimeException('Unable to permanently remove the promotion image.');
        }
    }
}
