/// API Configuration
/// Centralized configuration for all backend API endpoints
/// Supports both development and production environments

class ApiConfig {
  // Base URLs - matches React app configuration
  static const String _xamppBase = 'http://127.0.0.1';
  static const String _projectPath = '/GitHub/Capstone--Development';
  
  // Development URLs (for local XAMPP)
  static const String customerBaseDev = '$_xamppBase$_projectPath/customer';
  static const String laravelBaseDev = '$_xamppBase$_projectPath/laravel/public';
  static const String staffBaseDev = '$_xamppBase$_projectPath/staff';
  
  // Production URLs (to be configured based on deployment)
  static const String customerBaseProd = 'https://api.pastryshop.com/customer';
  static const String laravelBaseProd = 'https://api.pastryshop.com/laravel/public';
  static const String staffBaseProd = 'https://api.pastryshop.com/staff';

  // Use development URLs for now
  static const bool isDevelopment = true;

  /// Get the appropriate base URL based on environment
  static String get customerBase => isDevelopment ? customerBaseDev : customerBaseProd;
  static String get laravelBase => isDevelopment ? laravelBaseDev : laravelBaseProd;
  static String get staffBase => isDevelopment ? staffBaseDev : staffBaseProd;

  // ─── Authentication Endpoints ───────────────────────────────────────
  static String get loginEndpoint => '$customerBase/api_login.php';
  static String get registerEndpoint => '$customerBase/api_register.php';
  static String get forgotPasswordEndpoint => '$customerBase/api_forgot_password.php';
  static String get verifyResetCodeEndpoint => '$customerBase/api_verify_reset_password.php';
  static String get resetPasswordEndpoint => '$customerBase/api_reset_password.php';
  static String get googleLoginEndpoint => '$laravelBase/auth/google';
  static String get logoutEndpoint => '$customerBase/logout.php';

  // ─── User Endpoints ────────────────────────────────────────────────
  static String get getUserEndpoint => '$customerBase/api_user.php';
  static String get updateProfileEndpoint => '$customerBase/api_update_profile.php';
  static String get changePasswordEndpoint => '$customerBase/api_change_password.php';
  static String get deleteAccountEndpoint => '$customerBase/api_delete_account.php';

  // ─── Product Endpoints ─────────────────────────────────────────────
  static String get productsEndpoint => '$customerBase/api_products.php';
  static String get productDetailsEndpoint => '$customerBase/api_products.php';

  // ─── Cart Endpoints ────────────────────────────────────────────────
  static String get cartEndpoint => '$customerBase/cart_api.php';

  // ─── Order Endpoints ───────────────────────────────────────────────
  static String get ordersEndpoint => '$customerBase/api_orders.php';
  static String get placeOrderEndpoint => '$customerBase/api_place_order.php';
  static String get orderDetailsEndpoint => '$customerBase/api_orders.php';
  static String get cancelOrderEndpoint => '$customerBase/api_cancel_order.php';
  static String get confirmReceivedEndpoint => '$customerBase/api_confirm_received.php';

  // ─── Address Endpoints ────────────────────────────────────────────
  static String get addressesEndpoint => '$customerBase/api_addresses.php';
  static String get updateAddressEndpoint => '$customerBase/api_update_address.php';

  // ─── Favorites Endpoints ──────────────────────────────────────────
  static String get favoritesEndpoint => '$customerBase/api_favorites.php';

  // ─── Chat/Notifications Endpoints ────────────────────────────────
  static String get chatSendEndpoint => '$customerBase/api_chat_send.php';
  static String get chatFetchEndpoint => '$customerBase/api_chat_fetch.php';
  static String get notificationsEndpoint => '$customerBase/api_get_notifications.php';
  static String get markNotificationReadEndpoint => '$customerBase/api_mark_notif_read.php';

  // ─── Timeout Configurations ───────────────────────────────────────
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 30);

  // ─── HTTP Headers ────────────────────────────────────────────────
  static const Map<String, String> defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
