<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveProductRecipeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_size_id' => ['required', 'integer', 'exists:product_sizes,id'],
            'recipes' => ['required', 'array'],
            'recipes.*.ingredient_id' => ['required', 'integer', 'distinct', 'exists:ingredients,id'],
            'recipes.*.qty' => ['required', 'numeric', 'gt:0', 'max:999999.999'],
            'recipes.*.active' => ['sometimes', 'boolean'],
        ];
    }
}
