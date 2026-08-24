/// Authentication Response Models
/// Represents API responses for authentication operations

import 'package:json_annotation/json_annotation.dart';
import 'user_model.dart';

part 'auth_response_model.g.dart';

/// Generic API Response wrapper
@JsonSerializable(genericArgumentFactories: true)
class ApiResponse<T> {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  @JsonKey(name: 'data')
  final T? data;

  @JsonKey(name: 'error')
  final String? error;

  @JsonKey(name: 'code')
  final int? code;

  ApiResponse({
    required this.success,
    required this.message,
    this.data,
    this.error,
    this.code,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object? json) fromJsonT,
  ) =>
      _$ApiResponseFromJson(json, fromJsonT);

  Map<String, dynamic> toJson(Object? Function(T value) toJsonT) =>
      _$ApiResponseToJson(this, toJsonT);
}

/// Login Response Model
@JsonSerializable()
class LoginResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  @JsonKey(name: 'user')
  final User? user;

  @JsonKey(name: 'token', defaultValue: '')
  final String token;

  @JsonKey(name: 'token_type', defaultValue: 'Bearer')
  final String tokenType;

  @JsonKey(name: 'expires_in')
  final int? expiresIn;

  LoginResponse({
    required this.success,
    required this.message,
    this.user,
    this.token = '',
    this.tokenType = 'Bearer',
    this.expiresIn,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) =>
      _$LoginResponseFromJson(json);

  Map<String, dynamic> toJson() => _$LoginResponseToJson(this);

  @override
  String toString() =>
      'LoginResponse(success: $success, message: $message, user: $user)';
}

/// Register Response Model
@JsonSerializable()
class RegisterResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  @JsonKey(name: 'user')
  final User? user;

  @JsonKey(name: 'token', defaultValue: '')
  final String token;

  RegisterResponse({
    required this.success,
    required this.message,
    this.user,
    this.token = '',
  });

  factory RegisterResponse.fromJson(Map<String, dynamic> json) =>
      _$RegisterResponseFromJson(json);

  Map<String, dynamic> toJson() => _$RegisterResponseToJson(this);
}

/// Forgot Password Response Model
@JsonSerializable()
class ForgotPasswordResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  ForgotPasswordResponse({
    required this.success,
    required this.message,
  });

  factory ForgotPasswordResponse.fromJson(Map<String, dynamic> json) =>
      _$ForgotPasswordResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ForgotPasswordResponseToJson(this);
}

/// Verify Reset Code Response Model
@JsonSerializable()
class VerifyResetCodeResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  @JsonKey(name: 'token', defaultValue: '')
  final String token;

  VerifyResetCodeResponse({
    required this.success,
    required this.message,
    this.token = '',
  });

  factory VerifyResetCodeResponse.fromJson(Map<String, dynamic> json) =>
      _$VerifyResetCodeResponseFromJson(json);

  Map<String, dynamic> toJson() => _$VerifyResetCodeResponseToJson(this);
}

/// Reset Password Response Model
@JsonSerializable()
class ResetPasswordResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  ResetPasswordResponse({
    required this.success,
    required this.message,
  });

  factory ResetPasswordResponse.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ResetPasswordResponseToJson(this);
}

/// Error Response Model
@JsonSerializable()
class ErrorResponse {
  @JsonKey(name: 'success')
  final bool success;

  @JsonKey(name: 'message')
  final String message;

  @JsonKey(name: 'errors')
  final Map<String, dynamic>? errors;

  ErrorResponse({
    required this.success,
    required this.message,
    this.errors,
  });

  factory ErrorResponse.fromJson(Map<String, dynamic> json) =>
      _$ErrorResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ErrorResponseToJson(this);
}
