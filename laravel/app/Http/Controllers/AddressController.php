<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class AddressController extends Controller
{
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        try {
            $addresses = DB::table('addresses')
                ->where('customer_id', $user->id)
                ->orderByDesc('is_default')
                ->orderByDesc('address_id')
                ->get();

            return response()->json([
                'success' => true,
                'addresses' => $addresses
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        $addressId = intval($request->input('address_id', 0));
        $isDefault = $request->input('is_default') ? 1 : 0;

        if ($isDefault) {
            DB::table('addresses')->where('customer_id', $user->id)->update(['is_default' => 0]);
        }

        try {
            $data = [
                'customer_id' => $user->id,
                'address_label' => $request->input('address_label', 'Home'),
                'recipient_name' => $request->input('recipient_name', ''),
                'contact_number' => $request->input('contact_number', ''),
                'house_no' => $request->input('house_no', ''),
                'street' => $request->input('street', ''),
                'barangay' => $request->input('barangay', ''),
                'city' => $request->input('city', ''),
                'province' => $request->input('province', ''),
                'zip_code' => $request->input('zip_code', ''),
                'landmark' => $request->input('landmark', ''),
                'delivery_instructions' => $request->input('delivery_instructions', ''),
                'is_default' => $isDefault,
                'updated_at' => now(),
            ];

            if ($addressId > 0) {
                // Update existing
                DB::table('addresses')
                    ->where('address_id', $addressId)
                    ->where('customer_id', $user->id)
                    ->update($data);
                $id = $addressId;
            } else {
                // Create new
                $data['created_at'] = now();
                $id = DB::table('addresses')->insertGetId($data);
            }

            $addresses = DB::table('addresses')
                ->where('customer_id', $user->id)
                ->orderByDesc('is_default')
                ->orderByDesc('address_id')
                ->get();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'address_id' => $id,
                'addresses' => $addresses,
                'message' => $addressId > 0 ? 'Address updated successfully' : 'Address saved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        $isDefault = $request->input('is_default') ? 1 : 0;
        if ($isDefault) {
            DB::table('addresses')->where('customer_id', $user->id)->update(['is_default' => 0]);
        }

        try {
            DB::table('addresses')
                ->where('address_id', $id)
                ->where('customer_id', $user->id)
                ->update([
                    'address_label' => $request->input('address_label'),
                    'recipient_name' => $request->input('recipient_name'),
                    'contact_number' => $request->input('contact_number'),
                    'house_no' => $request->input('house_no'),
                    'street' => $request->input('street'),
                    'barangay' => $request->input('barangay'),
                    'city' => $request->input('city'),
                    'province' => $request->input('province'),
                    'zip_code' => $request->input('zip_code'),
                    'landmark' => $request->input('landmark'),
                    'delivery_instructions' => $request->input('delivery_instructions'),
                    'is_default' => $isDefault,
                    'updated_at' => now(),
                ]);

            $addresses = DB::table('addresses')
                ->where('customer_id', $user->id)
                ->orderByDesc('is_default')
                ->orderByDesc('address_id')
                ->get();

            return response()->json([
                'status' => 'success',
                'success' => true,
                'addresses' => $addresses,
                'message' => 'Address updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        DB::table('addresses')
            ->where('address_id', $id)
            ->where('customer_id', $user->id)
            ->delete();

        return response()->json(['success' => true]);
    }
}
