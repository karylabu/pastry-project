<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CakeSize extends Model
{
    use HasFactory;

    protected $table = 'cake_sizes';

    protected $fillable = [
        'code',
        'label',
        'multiplier',
        'active',
    ];

    protected $casts = [
        'multiplier' => 'float',
        'active' => 'boolean',
    ];
}
