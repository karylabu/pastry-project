<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IngredientMovement extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'ingredient_movements';

    protected $fillable = [
        'ingredient_id',
        'batch_id',
        'action',
        'qty',
        'note',
        'user_id',
        'reference_type',
        'reference_id',
        'previous_stock',
        'new_stock',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function batch()
    {
        return $this->belongsTo(IngredientBatch::class, 'batch_id');
    }
}
