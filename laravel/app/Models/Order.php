<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'items',
        'subtotal',
        'delivery_fee',
        'total',
        'method',
        'delivery_date',
        'delivery_time',
        'payment',
        'address',
        'phone',
        'lat',
        'lng',
        'status',
        'payment_status',
        'payment_link',
        'payment_reference',
        'customer',
        'email',
        'address_id',
        'order_type',
        'is_customized'
    ];

    protected $casts = [
        'items' => 'array',
        'subtotal' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'total' => 'decimal:2',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'is_customized' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function customCakeDetails()
    {
        return $this->hasOne(CustomCakeOrder::class);
    }
}
