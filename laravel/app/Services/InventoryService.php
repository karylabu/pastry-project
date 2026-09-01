<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\IngredientBatch;
use App\Models\IngredientMovement;
use App\Models\DiscardRequest;
use App\Models\WasteLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\UniqueConstraintViolationException;
use RuntimeException;

class InventoryService
{
    public function receiveBatch(Ingredient $ingredient, array $data, ?int $userId = null): IngredientBatch
    {
        return DB::transaction(function () use ($ingredient, $data, $userId) {
            $lockedIngredient = Ingredient::query()->whereKey($ingredient->getKey())->lockForUpdate()->first();
            if (!$lockedIngredient) {
                throw new RuntimeException('Ingredient not found.');
            }

            try {
                $batch = $lockedIngredient->batches()->create([
                    'batch_number' => $data['batch_number'],
                    'quantity_received' => $data['quantity_received'],
                    'quantity_remaining' => $data['quantity_received'],
                    'purchase_date' => $data['purchase_date'] ?? null,
                    'expiry_date' => $data['expiry_date'] ?? null,
                    'supplier' => $data['supplier'] ?? null,
                    'unit_cost' => $data['unit_cost'] ?? 0,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ]);
            } catch (UniqueConstraintViolationException $exception) {
                throw new RuntimeException('This batch number already exists for the ingredient.');
            }

            $newStock = $this->synchronizeIngredientStock($lockedIngredient->id);
            IngredientMovement::create([
                'ingredient_id' => $lockedIngredient->id,
                'batch_id' => $batch->id,
                'action' => 'stock_in',
                'qty' => $batch->quantity_received,
                'note' => "Stock In batch {$batch->batch_number}",
                'user_id' => $userId,
                'reference_type' => 'ingredient_batch',
                'reference_id' => $batch->id,
                'previous_stock' => $newStock - $batch->quantity_received,
                'new_stock' => $newStock,
            ]);

            $batch->refresh();
            $batch->setAttribute('synchronized_stock', $newStock);
            return $batch;
        });
    }

    public function synchronizeIngredientStock(int $ingredientId): float
    {
        $newStock = (float) IngredientBatch::query()
            ->where('ingredient_id', $ingredientId)
            ->sum('quantity_remaining');

        Ingredient::query()->whereKey($ingredientId)->update([
            'stock' => $newStock,
            'updated_at' => now(),
        ]);

        return $newStock;
    }

    public function recordMovement(int $ingredientId, int $batchId, float $quantity, string $note, int $userId, string $referenceType, int $referenceId, float $previousStock, float $newStock): IngredientMovement
    {
        return IngredientMovement::create([
            'ingredient_id' => $ingredientId,
            'batch_id' => $batchId,
            'action' => 'stock_out',
            'qty' => $quantity,
            'note' => $note,
            'user_id' => $userId,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'previous_stock' => $previousStock,
            'new_stock' => $newStock,
        ]);
    }

    public function getUsableStock(int $ingredientId): float
    {
        return (float) IngredientBatch::query()
            ->where('ingredient_id', $ingredientId)
            ->where('quantity_remaining', '>', 0)
            ->where(function ($query) {
                $query->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', today());
            })
            ->whereDoesntHave('discardRequests', function ($query) {
                $query->where('status', 'Pending');
            })
            ->sum('quantity_remaining');
    }

    public function createDiscardRequest(array $data, int $userId): DiscardRequest
    {
        return DB::transaction(function () use ($data, $userId) {
            $batch = IngredientBatch::query()->whereKey($data['ingredient_batch_id'])->lockForUpdate()->first();
            if (!$batch || (int) $batch->ingredient_id !== (int) $data['ingredient_id']) {
                throw new RuntimeException('The selected batch does not belong to the ingredient.');
            }
            if ((float) $data['quantity'] > (float) $batch->quantity_remaining) {
                throw new RuntimeException('Discard quantity cannot exceed available batch quantity.');
            }
            if ($batch->discardRequests()->where('status', 'Pending')->exists()) {
                throw new RuntimeException('A discard request is already pending for this batch.');
            }

            return DiscardRequest::create([
                'ingredient_id' => $batch->ingredient_id,
                'ingredient_batch_id' => $batch->id,
                'quantity' => $data['quantity'],
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'status' => 'Pending',
                'requested_by' => $userId,
            ]);
        });
    }

    public function approveDiscard(int $requestId, int $userId): DiscardRequest
    {
        return DB::transaction(function () use ($requestId, $userId) {
            $discard = DiscardRequest::query()->whereKey($requestId)->lockForUpdate()->first();
            if (!$discard) throw new RuntimeException('Discard request not found.');
            if ($discard->status !== 'Pending') throw new RuntimeException('Discard request has already been processed.');

            $ingredient = Ingredient::query()->whereKey($discard->ingredient_id)->lockForUpdate()->first();
            $batch = IngredientBatch::query()->whereKey($discard->ingredient_batch_id)->lockForUpdate()->first();
            if (!$ingredient || !$batch || (int) $batch->ingredient_id !== (int) $discard->ingredient_id) {
                throw new RuntimeException('Discard request batch is no longer valid.');
            }

            $quantity = (float) $discard->quantity;
            if ($quantity <= 0 || $quantity > (float) $batch->quantity_remaining) {
                throw new RuntimeException('Insufficient available batch stock for this discard.');
            }

            $before = (float) IngredientBatch::query()->where('ingredient_id', $ingredient->id)->sum('quantity_remaining');
            $updated = IngredientBatch::query()
                ->whereKey($batch->id)
                ->where('quantity_remaining', '>=', $quantity)
                ->decrement('quantity_remaining', $quantity, ['updated_at' => now()]);
            if ($updated !== 1) throw new RuntimeException('Unable to update discard batch stock.');

            $after = $this->synchronizeIngredientStock($ingredient->id);
            $note = "Waste / {$discard->reason} batch {$batch->batch_number}";
            IngredientMovement::create([
                'ingredient_id' => $ingredient->id,
                'batch_id' => $batch->id,
                'action' => 'stock_out',
                'qty' => $quantity,
                'note' => $note,
                'user_id' => $userId,
                'reference_type' => 'discard_request',
                'reference_id' => $discard->id,
                'previous_stock' => $before,
                'new_stock' => $after,
            ]);

            WasteLog::create([
                'datetime' => now(),
                'item' => $ingredient->name,
                'qty' => $quantity,
                'unit_cost' => (float) ($batch->unit_cost ?? 0),
                'item_type' => 'Raw Material',
                'reason' => $discard->reason,
                'ingredient_id' => $ingredient->id,
                'user_id' => $userId,
                'reference_type' => 'discard_request',
                'reference_id' => $discard->id,
                'ingredient_batch_id' => $batch->id,
                'requested_by' => $discard->requested_by,
                'approved_by' => $userId,
                'approved_at' => now(),
                'discarded_at' => now(),
                'unit' => $ingredient->unit,
                'discard_request_id' => $discard->id,
            ]);

            $discard->update(['status' => 'Approved', 'approved_by' => $userId, 'approved_at' => now(), 'discarded_at' => now()]);
            return $discard->fresh();
        });
    }

    public function rejectDiscard(int $requestId, int $userId, ?string $note = null): DiscardRequest
    {
        return DB::transaction(function () use ($requestId, $userId, $note) {
            $discard = DiscardRequest::query()->whereKey($requestId)->lockForUpdate()->first();
            if (!$discard) throw new RuntimeException('Discard request not found.');
            if ($discard->status !== 'Pending') throw new RuntimeException('Discard request has already been processed.');
            $discard->update(['status' => 'Rejected', 'rejected_by' => $userId, 'rejected_at' => now(), 'rejection_note' => $note]);
            return $discard->fresh();
        });
    }

    public function recordWaste(array $data, int $userId): WasteLog
    {
        return DB::transaction(function () use ($data, $userId) {
            $existing = !empty($data['idempotency_key'])
                ? WasteLog::query()->where('idempotency_key', $data['idempotency_key'])->first()
                : null;
            if ($existing) return $existing;

            $ingredient = Ingredient::query()->whereKey($data['ingredient_id'])->lockForUpdate()->first();
            $batch = IngredientBatch::query()->whereKey($data['ingredient_batch_id'])->lockForUpdate()->first();
            if (!$ingredient || !$batch || (int) $batch->ingredient_id !== (int) $ingredient->id) {
                throw new RuntimeException('The selected batch does not belong to the ingredient.');
            }
            if ($batch->discardRequests()->whereIn('status', ['Pending', 'Approved'])->exists()) {
                throw new RuntimeException('This batch has an active discard record and cannot be wasted again.');
            }

            $quantity = (float) $data['quantity'];
            if ($quantity > (float) $batch->quantity_remaining) {
                throw new RuntimeException('Waste quantity cannot exceed available batch quantity.');
            }

            $before = (float) IngredientBatch::query()->where('ingredient_id', $ingredient->id)->sum('quantity_remaining');
            if (IngredientBatch::query()->whereKey($batch->id)->where('quantity_remaining', '>=', $quantity)->decrement('quantity_remaining', $quantity, ['updated_at' => now()]) !== 1) {
                throw new RuntimeException('Unable to deduct waste batch quantity.');
            }
            $after = $this->synchronizeIngredientStock($ingredient->id);

            $waste = WasteLog::create([
                'datetime' => $data['datetime'] ?? now(),
                'item' => $ingredient->name,
                'qty' => $quantity,
                'unit_cost' => (float) $batch->unit_cost,
                'item_type' => 'Raw Material',
                'reason' => $data['reason'],
                'ingredient_id' => $ingredient->id,
                'user_id' => $userId,
                'reference_type' => 'waste',
                'ingredient_batch_id' => $batch->id,
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ]);
            IngredientMovement::create([
                'ingredient_id' => $ingredient->id,
                'batch_id' => $batch->id,
                'action' => 'stock_out',
                'qty' => $quantity,
                'note' => "Waste: {$data['reason']} batch {$batch->batch_number}",
                'user_id' => $userId,
                'reference_type' => 'waste',
                'reference_id' => $waste->id,
                'previous_stock' => $before,
                'new_stock' => $after,
            ]);

            return $waste;
        });
    }

    public function batchStatus(IngredientBatch $batch): string
    {
        if ($batch->quantity_remaining <= 0) return 'Depleted';
        if ($batch->discardRequests()->where('status', 'Pending')->exists()) return 'Pending Discard';
        if ($batch->expiry_date !== null && $batch->expiry_date->isBefore(today())) return 'Expired';
        return 'Usable';
    }

    public function getIngredientsWithBatchStock()
    {
        return Ingredient::query()
            ->select(['id', 'name', 'unit', 'stock', 'threshold', 'created_at', 'updated_at'])
            ->with('batches')
            ->orderBy('name')
            ->get()
            ->map(function (Ingredient $ingredient) {
                $batches = $ingredient->batches;
                $usableStock = $this->getUsableStock($ingredient->id);

                return [
                    'id' => (int) $ingredient->id,
                    'name' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'stock' => (float) $ingredient->stock,
                    'threshold' => (float) $ingredient->threshold,
                    'usable_stock' => $usableStock,
                    'has_usable_stock' => $usableStock > 0,
                    'has_expired_batches' => $batches->contains(fn (IngredientBatch $batch) => $batch->quantity_remaining > 0 && $batch->expiry_date?->isBefore(today())),
                    'batch_count' => $batches->count(),
                    'expired_batch_count' => $batches->filter(fn (IngredientBatch $batch) => $batch->quantity_remaining > 0 && $batch->expiry_date?->isBefore(today()))->count(),
                    'pending_discard_count' => $batches->filter(fn (IngredientBatch $batch) => $batch->discardRequests()->where('status', 'Pending')->exists())->count(),
                    'discarded_batch_count' => $batches->where('quantity_remaining', '<=', 0)->count(),
                ];
            });
    }

    public function getIngredientBatches(Ingredient $ingredient)
    {
        return $ingredient->batches()
            ->with('discardRequests:id,ingredient_batch_id,status')
            ->orderByRaw('expiry_date IS NULL')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->get()
            ->map(fn (IngredientBatch $batch) => $this->formatBatch($batch));
    }

    public function getAllIngredientBatches(?int $ingredientId = null)
    {
        $query = IngredientBatch::query()->with('discardRequests:id,ingredient_batch_id,status');
        if ($ingredientId !== null) {
            $query->where('ingredient_id', $ingredientId);
        }

        return $query
            ->orderByRaw('expiry_date IS NULL')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->get()
            ->map(fn (IngredientBatch $batch) => $this->formatBatch($batch));
    }

    private function formatBatch(IngredientBatch $batch): array
    {
        $pendingDiscard = $batch->discardRequests->contains(fn ($request) => $request->status === 'Pending');
        $expired = $batch->expiry_date !== null && $batch->expiry_date->isBefore(today());
        $status = $batch->quantity_remaining <= 0
            ? 'Depleted'
            : ($pendingDiscard ? 'Pending Discard' : ($expired ? 'Expired' : 'Usable'));

        return [
            'id' => (int) $batch->id,
            'ingredient_id' => (int) $batch->ingredient_id,
            'batch_number' => $batch->batch_number,
            'quantity_received' => (float) $batch->quantity_received,
            'quantity_remaining' => (float) $batch->quantity_remaining,
            'purchase_date' => $batch->purchase_date?->toDateString(),
            'expiry_date' => $batch->expiry_date?->toDateString(),
            'supplier' => $batch->supplier,
            'unit_cost' => (float) $batch->unit_cost,
            'notes' => $batch->notes,
            'created_at' => $batch->created_at,
            'status' => $status,
        ];
    }
}
