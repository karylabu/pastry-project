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

    public function trashProduct(int $productId): int
    {
        return $this->trashRecord('products', 'product', $productId);
    }

    public function trashIngredient(int $ingredientId): int
    {
        return $this->trashRecord('ingredients', 'ingredient', $ingredientId);
    }

    public function trashUser(int $userId): int
    {
        return $this->trashRecord('users', 'user', $userId);
    }

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
                case 'product':
                    $this->restoreRecord('products', (int) ($payload['id'] ?? 0));
                    break;
                case 'ingredient':
                    $this->restoreRecord('ingredients', (int) ($payload['id'] ?? 0));
                    break;
                case 'user':
                    $this->restoreRecord('users', (int) ($payload['id'] ?? 0));
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

        $this->permanentlyDeleteEntry($entry);
        DB::table('admin_recycle_bin')->where('id', $entryId)->delete();
    }

    private function trashRecord(string $table, string $type, int $recordId): int
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'deleted_at')) {
            throw new RuntimeException('Soft deletion is unavailable for this record type.');
        }

        return DB::transaction(function () use ($table, $type, $recordId): int {
            $record = DB::table($table)->where('id', $recordId)->lockForUpdate()->first();
            if (! $record || $record->deleted_at !== null) {
                throw new RuntimeException('Record not found or already in the Recycle Bin.');
            }

            $label = match ($type) {
                'product' => (string) ($record->name ?: "Product #{$recordId}"),
                'ingredient' => (string) ($record->name ?: "Ingredient #{$recordId}"),
                'user' => (string) ($record->name ?: "User #{$recordId}"),
                default => throw new RuntimeException('Unsupported record type.'),
            };
            $entryId = $this->createEntry($type, $label, ['id' => $recordId]);
            DB::table($table)->where('id', $recordId)->update(['deleted_at' => now()]);

            return $entryId;
        });
    }

    private function restoreRecord(string $table, int $recordId): void
    {
        if ($recordId < 1 || ! Schema::hasTable($table) || ! Schema::hasColumn($table, 'deleted_at')) {
            throw new RuntimeException('This Recycle Bin item cannot be restored.');
        }

        $restored = DB::table($table)
            ->where('id', $recordId)
            ->whereNotNull('deleted_at')
            ->update(['deleted_at' => null]);
        if ($restored !== 1) {
            throw new RuntimeException('This record no longer exists or has already been restored.');
        }
    }

    private function createEntry(string $type, string $label, array $payload): int
    {
        $this->purgeExpired();
        $now = now();
        return (int) DB::table('admin_recycle_bin')->insertGetId([
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
            $this->permanentlyDeleteEntry($entry);
            DB::table('admin_recycle_bin')->where('id', $entry->id)->delete();
        }
    }

    private function permanentlyDeleteEntry(object $entry): void
    {
        $payload = json_decode((string) $entry->payload, true, 512, JSON_THROW_ON_ERROR);
        switch ($entry->item_type) {
            case 'csv_import':
                $path = $payload['import']['stored_path'] ?? null;
                if ($path && Storage::disk('local')->exists($path) && ! Storage::disk('local')->delete($path)) {
                    throw new RuntimeException('Unable to permanently remove the stored CSV file.');
                }
                break;
            case 'promotion':
                $this->deletePromotionImage($payload['promotion']['image_url'] ?? null);
                break;
            case 'product':
                $this->deleteRelatedRows('product_id', (int) ($payload['id'] ?? 0));
                $this->deleteProductImages((int) ($payload['id'] ?? 0));
                break;
            case 'ingredient':
                $this->deleteRelatedRows('ingredient_id', (int) ($payload['id'] ?? 0));
                break;
            case 'user':
                $this->detachUserHistory((int) ($payload['id'] ?? 0));
                break;
        }

        if (in_array($entry->item_type, ['product', 'ingredient', 'user'], true)) {
            $table = match ($entry->item_type) {
                'product' => 'products',
                'ingredient' => 'ingredients',
                'user' => 'users',
            };
            if (Schema::hasTable($table)) {
                DB::table($table)->where('id', (int) ($payload['id'] ?? 0))->delete();
            }
        }
    }

    private function deleteRelatedRows(string $foreignKey, int $recordId): void
    {
        if ($recordId < 1) {
            return;
        }

        $tables = match ($foreignKey) {
            'product_id' => ['analytics_product_aliases', 'product_sizes', 'product_recipes', 'production_transactions', 'product_inventory_movements', 'production_batch_allocations'],
            'ingredient_id' => ['ingredient_batches', 'ingredient_movements', 'product_recipes', 'cake_recipe_ingredients', 'production_batch_allocations', 'waste_logs', 'discard_requests'],
            default => [],
        };
        foreach ($tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, $foreignKey)) {
                DB::table($table)->where($foreignKey, $recordId)->delete();
            }
        }
    }

    private function deleteProductImages(int $productId): void
    {
        $imageName = DB::table('products')->where('id', $productId)->value('image');
        if (! is_string($imageName) || ! preg_match('/^[A-Za-z0-9._-]+$/D', $imageName)) {
            return;
        }

        foreach ([base_path('../uploads/' . $imageName), public_path('uploads/' . $imageName)] as $path) {
            if (File::exists($path) && ! File::delete($path)) {
                throw new RuntimeException('Unable to permanently remove the product image.');
            }
        }
    }

    private function detachUserHistory(int $userId): void
    {
        if ($userId < 1) {
            return;
        }

        if (Schema::hasTable('addresses') && Schema::hasColumn('addresses', 'customer_id')) {
            DB::table('addresses')->where('customer_id', $userId)->delete();
        }
        if (Schema::hasTable('favorites') && Schema::hasColumn('favorites', 'customer_id')) {
            DB::table('favorites')->where('customer_id', $userId)->delete();
        }
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'user_id')) {
            DB::table('orders')->where('user_id', $userId)->update(['user_id' => null]);
        }
        if (Schema::hasTable('variance') && Schema::hasColumn('variance', 'recorded_by')) {
            DB::table('variance')->where('recorded_by', $userId)->update(['recorded_by' => null]);
        }
        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'user_id')) {
            $updates = ['user_id' => null];
            if (Schema::hasColumn('messages', 'customer_name')) $updates['customer_name'] = null;
            if (Schema::hasColumn('messages', 'customer_email')) $updates['customer_email'] = null;
            DB::table('messages')->where('user_id', $userId)->update($updates);
        }
        foreach (['user_sessions', 'customer_two_factor_login_challenges'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id')) {
                DB::table($table)->where('user_id', $userId)->delete();
            }
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
