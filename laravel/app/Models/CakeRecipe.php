<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CakeRecipe extends Model
{
    use HasFactory;

    protected $table = 'cake_recipes';

    protected $fillable = [
        'flavor_id',
        'base_size_id',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function flavor()
    {
        return $this->belongsTo(CakeFlavor::class, 'flavor_id');
    }

    public function baseSize()
    {
        return $this->belongsTo(CakeSize::class, 'base_size_id');
    }

    public function ingredients()
    {
        return $this->hasMany(CakeRecipeIngredient::class, 'recipe_id');
    }
}
