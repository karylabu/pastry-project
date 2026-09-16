<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_size_id' => 'required|integer|exists:product_sizes,id',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.name' => 'sometimes|string',
            'items.*.variant' => 'sometimes|string',
            'items.*.price' => 'sometimes|numeric',
            'items.*.selectionDetails' => 'sometimes|array',
            'items.*.image' => 'sometimes|string|nullable',
            'method' => 'required|string|in:Delivery,Deliver,Pickup',
            'payment' => 'required|string',
            'address' => 'required_if:method,Delivery,Deliver|string|nullable',
            'phone' => 'required|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'order_type' => 'nullable|string',
            'is_customized' => 'nullable|boolean',
        ];
    }
}
