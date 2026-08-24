    <?php
    session_start();

    /*
    |--------------------------------------------------------------------------
    | AUTH CHECK
    |--------------------------------------------------------------------------
    */
    if (!isset($_SESSION['user'])) {
        header('Location: staff_login.php');
        exit;
    }

    require_once __DIR__ . '/../includes/db.php';
    /*
    |--------------------------------------------------------------------------
    | FUNCTIONS
    |--------------------------------------------------------------------------
    */
    function getProducts()
    {
        return db_all(" 
            SELECT *
            FROM products
            ORDER BY name ASC
        ");
    }

    function getLowStock()
    {
        return db_all("
            SELECT *
            FROM products
            WHERE stock <= 5
            ORDER BY stock ASC
        ");
    }

    /*
    |--------------------------------------------------------------------------
    | DATA
    |--------------------------------------------------------------------------
    */
    $products = getProducts();
    $lowStock = getLowStock();

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */
    $search = $_GET['search'] ?? '';

    if (!empty($search)) {

        $products = array_filter($products, function ($p) use ($search) {

            return isset($p['name']) &&
                stripos($p['name'], $search) !== false;

        });
    }

    /*
    |--------------------------------------------------------------------------
    | STATUS HELPER
    |--------------------------------------------------------------------------
    */
    function getStockStatus($stock, $reorder_level = 0)
    {
        if ($stock <= 0) {
            return "out";
        }

        if ($stock <= $reorder_level) {
            return "low";
        }

        return "safe";
    }
    ?>

    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Manage Inventory</title>

    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">

    <style>

    body{
        margin:0;
        font-family:'DM Sans',sans-serif;
        background:#f5f5f5;
    }

    .container{
        padding:20px;
    }

    h2{
        margin-bottom:10px;
    }

    h3{
        margin-top:25px;
    }

    .grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:15px;
    }

    .card{
        background:#fff;
        padding:15px;
        border-radius:12px;
        border:1px solid #ddd;
    }

    .low{
        border-left:5px solid red;
    }

    .badge{
        display:inline-block;
        padding:4px 10px;
        border-radius:20px;
        font-size:11px;
        font-weight:700;
        margin-top:5px;
    }

    .safe{
        background:#e7f7ec;
        color:#2e7d32;
    }

    .lowb{
        background:#fff3cd;
        color:#b26a00;
    }

    .out{
        background:#f8d7da;
        color:#b71c1c;
    }

    input, select{
        width:100%;
        padding:10px;
        margin-top:8px;
        border-radius:8px;
        border:1px solid #ddd;
        box-sizing:border-box;
    }

    button{
        margin-top:10px;
        padding:10px;
        width:100%;
        border:none;
        background:#111;
        color:#fff;
        border-radius:8px;
        cursor:pointer;
        font-weight:600;
    }

    button:hover{
        opacity:0.9;
    }

    .search-box{
        margin-bottom:20px;
    }

    .search-box input{
        padding:10px;
        width:250px;
        border-radius:20px;
        border:1px solid #ddd;
    }

    .empty{
        background:#fff;
        padding:15px;
        border-radius:10px;
        border:1px solid #ddd;
        color:#777;
    }

    </style>
    </head>

    <body>

    <?php include __DIR__ . '/../includes/header.php'; ?>

    <div class="container">
        
    <h2>Manage Inventory</h2>

    <!-- SEARCH -->
    <form method="GET" class="search-box">
        <input
            type="text"
            name="search"
            placeholder="Search product..."
            value="<?= htmlspecialchars($search) ?>"
        >
    </form>

    <!-- LOW STOCK -->
    <h3>Low Stock Items</h3>

    <div class="grid">

    <?php if (empty($lowStock)): ?>

        <div class="empty">
            No low stock items 🎉
        </div>

    <?php else: ?>

        <?php foreach ($lowStock as $p): ?>

            <div class="card low">

                <h4>
                    <?= htmlspecialchars($p['name'] ?? 'Unknown') ?>
                </h4>

                <div>
                    Stock:
                    <b><?= $p['stock'] ?? 0 ?></b>
                </div>

            </div>

        <?php endforeach; ?>

    <?php endif; ?>

    </div>

    <!-- ALL PRODUCTS -->
    <h3>All Products</h3>

    <div class="grid">

    <?php if (empty($products)): ?>

        <div class="empty">
            No products found.
        </div>

    <?php else: ?>

        <?php foreach ($products as $p):

            $stock = $p['stock'] ?? 0;
            $reorder = 5 ;

            $status = getStockStatus($stock, $reorder);

            $badgeClass = $status === "low"
                ? "lowb"
                : $status;

        ?>

        <div class="card">

            <h4>
                <?= htmlspecialchars($p['name'] ?? 'Unnamed') ?>
            </h4>

            <div class="badge <?= $badgeClass ?>">
                <?= strtoupper($status) ?>
            </div>

            <div style="margin-top:10px;">
                Current Stock:
                <b><?= $stock ?></b>
            </div>

            <div>
                Reorder Level:
                <?= $reorder ?>
            </div>

            <!-- UPDATE STOCK -->
            <form method="POST" action="inventory_update.php">

                <input
                    type="hidden"
                    name="id"
                    value="<?= $p['id'] ?>"
                >

                <select name="type" required>
                    <option value="IN">
                        Stock IN (+)
                    </option>

                    <option value="OUT">
                        Stock OUT (-)
                    </option>
                </select>

                <input
                    type="number"
                    name="quantity"
                    placeholder="Quantity"
                    required
                    min="1"
                >

                <button type="submit">
                    Update Stock
                </button>

            </form>

        </div>

        <?php endforeach; ?>

    <?php endif; ?>

    </div>

    </div>

    </body>
    </html>