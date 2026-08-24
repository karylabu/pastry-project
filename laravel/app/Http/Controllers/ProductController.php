<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function index(Request $request)
    {
        if (session('user.role') === 'admin') {
            return redirect()->route('admin.products');
        }

        $filterCat = $request->query('cat', 'all');

        $products = $filterCat === 'all'
            ? DB::select('SELECT * FROM products')
            : DB::select('SELECT * FROM products WHERE category = ?', [$filterCat]);

        $categories = array_column(DB::select('SELECT DISTINCT category FROM products'), 'category');

        return view('products', compact('filterCat', 'products', 'categories'));
    }
}
