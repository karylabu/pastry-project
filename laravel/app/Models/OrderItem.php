<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'product',
        'variant',
        'qty',
        'price',
        'details',
        'image'
    ];

    protected $casts = [
        'details' => 'array',
        'price' => 'decimal:2',
        'qty' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
