<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    protected function resolvePayload(Request $request): array
    {
        $payload = $request->all();

        if (empty($payload) && $request->getContent()) {
            $decoded = json_decode($request->getContent(), true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }

        if (!is_array($payload)) {
            $payload = [];
        }

        if (array_key_exists('email', $payload)) {
            $payload['email'] = strtolower(trim((string) $payload['email']));
        }

        if (array_key_exists('phone_number', $payload) && !array_key_exists('phone', $payload)) {
            $payload['phone'] = $payload['phone_number'];
        }

        if (array_key_exists('role', $payload) && $payload['role'] === 'manager') {
            $payload['role'] = 'staff';
        }

        return $payload;
    }

    protected function normalizeValidatedData(array $validated): array
    {
        if (array_key_exists('phone_number', $validated)) {
            $validated['phone'] = $validated['phone_number'];
            unset($validated['phone_number']);
        }

        if (array_key_exists('password_confirmation', $validated)) {
            unset($validated['password_confirmation']);
        }

        if (array_key_exists('role', $validated) && $validated['role'] === 'manager') {
            $validated['role'] = 'staff';
        }

        if (array_key_exists('status', $validated) && !in_array($validated['status'], ['active', 'inactive', 'banned'], true)) {
            $validated['status'] = 'active';
        }

        if (array_key_exists('password', $validated) && $validated['password'] === '') {
            unset($validated['password']);
        }

        return $validated;
    }

    /**
     * Return a paginated list of users.
     */
    public function index(Request $request)
    {
        $query = User::query()->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%" );
            });
        }

        if ($request->filled('role')) {
            $role = $request->role;
            if (in_array($role, ['admin', 'manager', 'staff', 'customer'], true)) {
                $query->where('role', $role);
            }
        }

        if ($request->filled('status')) {
            $status = $request->status;
            if (in_array($status, ['active', 'inactive', 'banned'], true)) {
                $query->where('status', $status);
            }
        }

        $perPage = (int) $request->input('per_page', 10);
        $perPage = $perPage > 0 ? min($perPage, 50) : 10;

        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $users->items(),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Create a new user or staff account.
     */
    public function store(Request $request)
    {
        $payload = $this->resolvePayload($request);

        $validated = Validator::make($payload, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['required', Rule::in(['admin', 'manager', 'staff', 'customer'])],
            'status' => ['required', Rule::in(['active', 'inactive', 'banned'])],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $validated = $this->normalizeValidatedData($validated);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user = User::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'User created successfully.',
            'data' => $user,
        ], 201);
    }

    /**
     * Show a single user record.
     */
    public function show(User $user)
    {
        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * Update an existing user.
     */
    public function update(Request $request, User $user)
    {
        $payload = $this->resolvePayload($request);

        $validated = Validator::make($payload, [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['sometimes', Rule::in(['admin', 'manager', 'staff', 'customer'])],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'banned'])],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $validated = $this->normalizeValidatedData($validated);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully.',
            'data' => $user->fresh(),
        ]);
    }

    /**
     * Deactivate a user instead of permanently deleting them.
     */
    public function destroy(User $user)
    {
        $user->update(['status' => 'inactive']);

        return response()->json([
            'success' => true,
            'message' => 'User deactivated successfully.',
            'data' => $user->fresh(),
        ]);
    }
}
