<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomCakeOrder extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'cake_size',
        'quantity',
        'flavor',
        'filling',
        'frosting',
        'occasion',
        'theme_design',
        'preferred_colors',
        'tiers',
        'dedication',
        'notes',
        'estimated_price',
        'inspo_images'
    ];

    protected $casts = [
        'inspo_images' => 'array',
        'estimated_price' => 'decimal:2',
        'quantity' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
