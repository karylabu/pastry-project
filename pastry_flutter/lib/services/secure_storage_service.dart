/// Secure Storage Service
/// Handles secure storage of sensitive data like auth tokens and passwords
/// Uses flutter_secure_storage for secure persistence on device

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';
  static const String _userIdKey = 'user_id';
  static const String _userEmailKey = 'user_email';
  static const String _userRoleKey = 'user_role';
  static const String _rememberMeKey = 'remember_me';
  static const String _savedEmailKey = 'saved_email';

  static final SecureStorageService _instance = SecureStorageService._internal();

  final _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      keyCipherAlgorithm:
          KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
      storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
    ),
    iOptions: IOSOptions(
    ),
  );

  SecureStorageService._internal();

  factory SecureStorageService() {
    return _instance;
  }

  /// Save authentication token
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  /// Get authentication token
  Future<String?> getToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  /// Save refresh token
  Future<void> saveRefreshToken(String token) async {
    await _secureStorage.write(key: _refreshTokenKey, value: token);
  }

  /// Get refresh token
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  /// Save user data as JSON string
  Future<void> saveUserData(String userJson) async {
    await _secureStorage.write(key: _userKey, value: userJson);
  }

  /// Get user data as JSON string
  Future<String?> getUserData() async {
    return await _secureStorage.read(key: _userKey);
  }

  /// Save user ID
  Future<void> saveUserId(int userId) async {
    await _secureStorage.write(key: _userIdKey, value: userId.toString());
  }

  /// Get user ID
  Future<int?> getUserId() async {
    final userId = await _secureStorage.read(key: _userIdKey);
    return userId != null ? int.tryParse(userId) : null;
  }

  /// Save user email
  Future<void> saveUserEmail(String email) async {
    await _secureStorage.write(key: _userEmailKey, value: email);
  }

  /// Get user email
  Future<String?> getUserEmail() async {
    return await _secureStorage.read(key: _userEmailKey);
  }

  /// Save user role
  Future<void> saveUserRole(String role) async {
    await _secureStorage.write(key: _userRoleKey, value: role);
  }

  /// Get user role
  Future<String?> getUserRole() async {
    return await _secureStorage.read(key: _userRoleKey);
  }

  /// Save "Remember Me" preference
  Future<void> setRememberMe(bool remember) async {
    await _secureStorage.write(
      key: _rememberMeKey,
      value: remember.toString(),
    );
  }

  /// Get "Remember Me" preference
  Future<bool> getRememberMe() async {
    final value = await _secureStorage.read(key: _rememberMeKey);
    return value == 'true';
  }

  /// Save email for auto-fill on login screen
  Future<void> saveSavedEmail(String email) async {
    await _secureStorage.write(key: _savedEmailKey, value: email);
  }

  /// Get saved email
  Future<String?> getSavedEmail() async {
    return await _secureStorage.read(key: _savedEmailKey);
  }

  /// Clear specific key
  Future<void> delete(String key) async {
    await _secureStorage.delete(key: key);
  }

  /// Clear all authentication data on logout
  Future<void> clearAuthData() async {
    await Future.wait([
      _secureStorage.delete(key: _tokenKey),
      _secureStorage.delete(key: _refreshTokenKey),
      _secureStorage.delete(key: _userKey),
      _secureStorage.delete(key: _userIdKey),
      _secureStorage.delete(key: _userEmailKey),
      _secureStorage.delete(key: _userRoleKey),
    ]);
  }

  /// Clear all data including preferences
  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
  }

  /// Check if user is authenticated (has token)
  Future<bool> isAuthenticated() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
