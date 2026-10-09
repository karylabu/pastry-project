<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $payload = json_decode((string) $this->input('order_payload'), true);
        if (is_array($payload)) {
            $this->merge($payload);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_size_id' => 'nullable|integer|min:0',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.name' => 'sometimes|string',
            'items.*.variant' => 'nullable|string|max:50',
            'items.*.price' => 'sometimes|numeric',
            'items.*.selectionDetails' => 'sometimes|array',
            'items.*.selectionDetails.extras' => 'sometimes|array',
            'items.*.selectionDetails.extras.*.name' => 'required|string|max:50',
            'items.*.image' => 'sometimes|string|nullable',
            'method' => 'required|string|in:Delivery,Deliver,Pickup',
            'delivery_service' => 'nullable|string|in:Lalamove,GrabCar',
            'delivery_time' => 'nullable|date_format:H:i',
            'payment' => 'required|string',
            'address' => 'required_if:method,Delivery,Deliver|string|nullable',
            'phone' => 'required|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'order_type' => 'nullable|string',
            'is_customized' => 'nullable|boolean',
            'discount_type' => 'nullable|in:none,senior_citizen,pwd,first_order_5_percent,reward_5_percent',
            'discount_id_image' => 'exclude_unless:discount_type,senior_citizen,pwd|required|image|mimes:jpeg,jpg,png,webp|max:5120',
            'reward_code' => 'nullable|string|max:32',
        ];
    }
}
