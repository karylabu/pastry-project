<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentPage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContentPageController extends Controller
{
    private const PAGE_SLUGS = [
        'about-us',
        'terms',
        'privacy-policy',
        'cookie-policy',
        'return-policy',
        'contact-information',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return response()->json([
            'success' => true,
            'data' => ContentPage::withTrashed()->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validator = Validator::make($request->all(), [
            'slug' => 'required|string|in:' . implode(',', self::PAGE_SLUGS),
            'title' => 'required|string|max:150',
            'content' => 'nullable|string|max:50000',
            'is_published' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the page details and try again.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $page = ContentPage::withTrashed()->firstOrNew(['slug' => $validator->validated()['slug']]);
        $page->fill($validator->validated());
        if ($page->trashed()) {
            $page->restore();
        } else {
            $page->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Page saved successfully.',
            'data' => $page->fresh(),
        ], 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $page = ContentPage::where('slug', $slug)->first();
        if (! $page) {
            return response()->json(['success' => false, 'message' => 'Page not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:150',
            'content' => 'nullable|string|max:50000',
            'is_published' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the page details and try again.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $page->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Page updated successfully.',
            'data' => $page->fresh(),
        ]);
    }

    public function destroy(Request $request, string $slug): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $page = ContentPage::where('slug', $slug)->first();
        if (! $page) {
            return response()->json(['success' => false, 'message' => 'Page not found.'], 404);
        }

        $page->delete();

        return response()->json(['success' => true, 'message' => 'Page deleted successfully.']);
    }

    public function show(string $slug): JsonResponse
    {
        if (! in_array($slug, self::PAGE_SLUGS, true)) {
            return response()->json(['success' => false, 'message' => 'Page not found.'], 404);
        }

        $page = ContentPage::withTrashed()->where('slug', $slug)->first();
        if (! $page) {
            return response()->json(['success' => false, 'message' => 'Page not found.'], 404);
        }

        if ($page->trashed() || ! $page->is_published) {
            return response()->json(['success' => false, 'message' => 'This page is not available.'], 410);
        }

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }

    private function adminUser(Request $request): User|JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        if (! $user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }

        return $user;
    }
}
