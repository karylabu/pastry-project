<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateWasteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ingredient_id' => ['required', 'integer', 'exists:ingredients,id'],
            'ingredient_batch_id' => [
                'required',
                'integer',
                Rule::exists('ingredient_batches', 'id')->where(fn ($query) => $query->where('ingredient_id', $this->input('ingredient_id'))),
            ],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1024'],
            'datetime' => ['nullable', 'date'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ];
    }
}
