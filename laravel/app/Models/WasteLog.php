<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WasteLog extends Model
{
    use HasFactory;

    protected $table = 'waste_log';

    public $timestamps = false;

    protected $fillable = [
        'datetime',
        'item',
        'qty',
        'unit_cost',
        'item_type',
        'reason',
        'ingredient_id',
        'product_id',
        'user_id',
        'reference_type',
        'reference_id',
        'ingredient_batch_id',
        'requested_by',
        'approved_by',
        'approved_at',
        'discarded_at',
        'unit',
        'discard_request_id',
        'idempotency_key',
    ];

    protected $casts = [
        'datetime' => 'datetime',
        'qty' => 'float',
        'unit_cost' => 'float',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function batch()
    {
        return $this->belongsTo(IngredientBatch::class, 'ingredient_batch_id');
    }
}
