<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class DiscardRequest extends Model
{
    use HasFactory;

    protected $table = 'discard_requests';

    public $timestamps = false;

    protected $fillable = [
        'ingredient_id',
        'ingredient_batch_id',
        'quantity',
        'reason',
        'notes',
        'status',
        'requested_by',
        'requested_at',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'discarded_at',
        'rejection_note',
    ];

    protected $casts = [
        'quantity' => 'float',
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'discarded_at' => 'datetime',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function ingredientBatch()
    {
        return $this->belongsTo(IngredientBatch::class, 'ingredient_batch_id');
    }

    public function batch()
    {
        return $this->ingredientBatch();
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }
}
