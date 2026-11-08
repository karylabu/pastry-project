<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Product;

class ProductSize extends Model
{
    protected $table = 'product_sizes';

    protected $fillable = [
        'product_id',
        'size',
        'price',
        'available',
        'is_archived',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'available' => 'boolean',
        'is_archived' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function recipes()
    {
        return $this->hasMany(ProductRecipe::class);
    }

    public function getAvailableAttribute(): bool
    {
        return (bool) $this->getRawOriginal('available');
    }
}
