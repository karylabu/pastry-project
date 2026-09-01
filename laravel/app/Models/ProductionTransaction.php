<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionTransaction extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'production_transactions';

    protected $fillable = ['product_id', 'quantity', 'user_id', 'idempotency_key'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function allocations()
    {
        return $this->hasMany(ProductionBatchAllocation::class, 'production_transaction_id');
    }
}
