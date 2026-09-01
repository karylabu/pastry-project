<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionBatchAllocation extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'production_batch_allocations';

    protected $fillable = [
        'production_transaction_id',
        'ingredient_id',
        'ingredient_batch_id',
        'quantity_consumed',
    ];

    protected $casts = ['quantity_consumed' => 'float'];

    public function productionTransaction()
    {
        return $this->belongsTo(ProductionTransaction::class);
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function batch()
    {
        return $this->belongsTo(IngredientBatch::class, 'ingredient_batch_id');
    }
}
