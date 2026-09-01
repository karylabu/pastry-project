<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IngredientBatch extends Model
{
    use HasFactory;

    protected $table = 'ingredient_batches';

    protected $fillable = [
        'ingredient_id',
        'batch_number',
        'quantity_received',
        'quantity_remaining',
        'purchase_date',
        'expiry_date',
        'supplier',
        'unit_cost',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'quantity_received' => 'float',
        'quantity_remaining' => 'float',
        'unit_cost' => 'float',
        'purchase_date' => 'date',
        'expiry_date' => 'date',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function movements()
    {
        return $this->hasMany(IngredientMovement::class, 'batch_id');
    }

    public function discardRequests()
    {
        return $this->hasMany(DiscardRequest::class, 'ingredient_batch_id');
    }

    public function productionAllocations()
    {
        return $this->hasMany(ProductionBatchAllocation::class, 'ingredient_batch_id');
    }
}
