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
        'stock',
        'threshold',
        'expiry',
    ];

    protected $casts = [
        'stock' => 'float',
        'threshold' => 'float',
        'expiry' => 'date',
    ];
}
