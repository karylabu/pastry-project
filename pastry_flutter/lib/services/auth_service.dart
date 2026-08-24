/// Authentication Service
/// Handles all authentication-related API calls and business logic
/// Coordinates between API service and storage service

import 'dart:convert';
import 'package:logger/logger.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';
import '../models/auth_response_model.dart';
import 'api_service.dart';
import 'secure_storage_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();

  final _apiService = ApiService();
  final _storage = SecureStorageService();
  final _logger = Logger();

  AuthService._internal();

  factory AuthService() {
    return _instance;
  }

  /// Login with email and password
  /// Returns LoginResponse which contains user and token on success
  Future<LoginResponse> login({
    required String email,
    required String password,
    bool rememberMe = false,
  }) async {
    try {
      _logger.i('🔐 Attempting login for: $email');

      final response = await _apiService.post<Map<String, dynamic>>(
        ApiConfig.loginEndpoint,
        data: {
          'email': email.trim(),
          'password': password,
        },
      );

      final loginResponse = LoginResponse.fromJson(response.data!);

      if (loginResponse.success && loginResponse.user != null) {
        _logger.i('✅ Login successful for: ${loginResponse.user!.email}');

        // Save user and token
        await _saveUserSession(
          user: loginResponse.user!,
          token: loginResponse.token,
          rememberMe: rememberMe,
          email: email,
        );

        return loginResponse;
      } else {
        _logger.w('❌ Login failed: ${loginResponse.message}');
        return loginResponse;
      }
    } catch (e) {
      _logger.e('🚨 Login error', error: e);
      rethrow;
    }
  }

  /// Register new user
  Future<RegisterResponse> register({
    required String name,
    required String email,
    required String password,
    required String confirmPassword,
    String phone = '',
    bool agreeTerms = false,
    bool agreePrivacy = false,
  }) async {
    try {
      _logger.i('📝 Attempting registration for: $email');

      if (password != confirmPassword) {
        throw Exception('Passwords do not match');
      }

      final response = await _apiService.post<Map<String, dynamic>>(
        ApiConfig.registerEndpoint,
        data: {
          'name': name.trim(),
          'email': email.trim(),
          'password': password,
          'password_confirmation': confirmPassword,
          'phone': phone.trim(),
          'agree_terms': agreeTerms ? 1 : 0,
          'agree_privacy': agreePrivacy ? 1 : 0,
        },
      );

      final registerResponse = RegisterResponse.fromJson(response.data!);

      if (registerResponse.success && registerResponse.user != null) {
        _logger.i('✅ Registration successful');
      } else {
        _logger.w('❌ Registration failed: ${registerResponse.message}');
      }

      return registerResponse;
    } catch (e) {
      _logger.e('🚨 Registration error', error: e);
      rethrow;
    }
  }

  /// Request password reset code
  Future<ForgotPasswordResponse> requestPasswordReset(String email) async {
    try {
      _logger.i('📧 Requesting password reset for: $email');

      final response = await _apiService.post<Map<String, dynamic>>(
        ApiConfig.forgotPasswordEndpoint,
        data: {'email': email.trim()},
      );

      final forgotResponse = ForgotPasswordResponse.fromJson(response.data!);

      if (forgotResponse.success) {
        _logger.i('✅ Password reset code sent');
      } else {
        _logger.w('❌ Password reset failed: ${forgotResponse.message}');
      }

      return forgotResponse;
    } catch (e) {
      _logger.e('🚨 Password reset error', error: e);
      rethrow;
    }
  }

  /// Verify password reset code
  Future<VerifyResetCodeResponse> verifyResetCode({
    required String email,
    required String code,
  }) async {
    try {
      _logger.i('🔐 Verifying reset code');

      final response = await _apiService.post<Map<String, dynamic>>(
        ApiConfig.verifyResetCodeEndpoint,
        data: {
          'email': email.trim(),
          'code': code.trim(),
        },
      );

      final verifyResponse = VerifyResetCodeResponse.fromJson(response.data!);

      if (verifyResponse.success) {
        _logger.i('✅ Reset code verified');
      } else {
        _logger.w('❌ Code verification failed: ${verifyResponse.message}');
      }

      return verifyResponse;
    } catch (e) {
      _logger.e('🚨 Code verification error', error: e);
      rethrow;
    }
  }

  /// Reset password with verification code
  Future<ResetPasswordResponse> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      _logger.i('🔄 Resetting password');

      final response = await _apiService.post<Map<String, dynamic>>(
        ApiConfig.resetPasswordEndpoint,
        data: {
          'email': email.trim(),
          'code': code.trim(),
          'new_password': newPassword,
        },
      );

      final resetResponse = ResetPasswordResponse.fromJson(response.data!);

      if (resetResponse.success) {
        _logger.i('✅ Password reset successfully');
      } else {
        _logger.w('❌ Password reset failed: ${resetResponse.message}');
      }

      return resetResponse;
    } catch (e) {
      _logger.e('🚨 Password reset error', error: e);
      rethrow;
    }
  }

  /// Get current user profile
  /// Requires authentication token
  Future<User> getCurrentUser() async {
    try {
      _logger.i('👤 Fetching current user profile');

      final response = await _apiService.get<Map<String, dynamic>>(
        ApiConfig.getUserEndpoint,
      );

      if (response.data != null && response.data!['data'] != null) {
        final user = User.fromJson(response.data!['data']);
        _logger.i('✅ User profile fetched');
        return user;
      } else {
        throw Exception('Invalid response format');
      }
    } catch (e) {
      _logger.e('🚨 Get user error', error: e);
      rethrow;
    }
  }

  /// Logout user
  /// Clears local session and notifies backend
  Future<void> logout() async {
    try {
      _logger.i('🚪 Logging out');

      // Try to notify backend of logout
      try {
        await _apiService.post<Map<String, dynamic>>(
          ApiConfig.logoutEndpoint,
        );
      } catch (e) {
        _logger.w('⚠️ Backend logout failed, clearing local session anyway');
      }

      // Clear local session
      await _storage.clearAuthData();
      _logger.i('✅ Logout successful');
    } catch (e) {
      _logger.e('🚨 Logout error', error: e);
      rethrow;
    }
  }

  /// Get stored user data from local storage
  Future<User?> getStoredUser() async {
    try {
      final userJson = await _storage.getUserData();
      if (userJson != null) {
        return User.fromJson(jsonDecode(userJson));
      }
      return null;
    } catch (e) {
      _logger.e('🚨 Get stored user error', error: e);
      return null;
    }
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    return await _storage.isAuthenticated();
  }

  /// Get stored authentication token
  Future<String?> getToken() async {
    return await _storage.getToken();
  }

  /// Save user session locally
  Future<void> _saveUserSession({
    required User user,
    required String token,
    required bool rememberMe,
    required String email,
  }) async {
    await Future.wait([
      _storage.saveToken(token),
      _storage.saveUserData(jsonEncode(user.toJson())),
      _storage.saveUserId(user.id),
      _storage.saveUserEmail(user.email),
      _storage.saveUserRole(user.role),
      _storage.setRememberMe(rememberMe),
      if (rememberMe) _storage.saveSavedEmail(email),
    ]);
  }

  /// Refresh user session (useful if token expires)
  /// Refresh token support pending backend implementation.
  Future<void> refreshSession() async {
    try {
      _logger.i(' Refreshing session');
      final user = await getCurrentUser();
      // Update stored user
      await _storage.saveUserData(jsonEncode(user.toJson()));
      _logger.i(' Session refreshed');
    } catch (e) {
      _logger.e(' Session refresh error', error: e);
      rethrow;
    }
  }
}
