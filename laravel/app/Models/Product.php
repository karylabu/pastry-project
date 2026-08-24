<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
        'price',
        'solo_price',
        'sharing_price',
        'stock',
        'image',
        'description',
        'available',
        'slice_price',
        'small_price',
        'big_price',
        'meal_price',
        'combo_price',
        'tag',
        'is_custom',
        'reorder_level'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'stock' => 'integer',
        'available' => 'boolean',
        'is_custom' => 'boolean',
    ];
}
