<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ingredient extends Model
{
    use HasFactory;

    protected $table = 'ingredients';

    protected $fillable = [
        'name',
        'unit',
        'threshold',
    ];

    protected $casts = [
        'stock' => 'float',
        'threshold' => 'float',
        'expiry' => 'date',
    ];

    public function batches()
    {
        return $this->hasMany(IngredientBatch::class);
    }

    public function ingredientBatches()
    {
        return $this->batches();
    }

    public function movements()
    {
        return $this->hasMany(IngredientMovement::class);
    }

    public function recipes()
    {
        return $this->hasMany(ProductRecipe::class);
    }
}
