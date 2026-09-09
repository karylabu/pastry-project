<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CakeFlavor extends Model
{
    use HasFactory;

    protected $table = 'cake_flavors';

    protected $fillable = [
        'name',
        'slug',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function recipes()
    {
        return $this->hasMany(CakeRecipe::class, 'flavor_id');
    }
}
