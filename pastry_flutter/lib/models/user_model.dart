/// User Model
/// Represents a user in the system with their profile information
/// Corresponds to the API response from login and user endpoints

import 'package:json_annotation/json_annotation.dart';

part 'user_model.g.dart';

@JsonSerializable()
class User {
  @JsonKey(name: 'id')
  final int id;

  @JsonKey(name: 'user_id')
  final int? userId;

  @JsonKey(name: 'name')
  final String name;

  @JsonKey(name: 'email')
  final String email;

  @JsonKey(name: 'phone', defaultValue: '')
  final String phone;

  @JsonKey(name: 'role')
  final String role;

  @JsonKey(name: 'address', defaultValue: '')
  final String address;

  @JsonKey(name: 'city', defaultValue: '')
  final String city;

  @JsonKey(name: 'postal_code', defaultValue: '')
  final String postalCode;

  @JsonKey(name: 'country', defaultValue: '')
  final String country;

  @JsonKey(name: 'profile_picture', defaultValue: '')
  final String? profilePicture;

  @JsonKey(name: 'created_at')
  final String? createdAt;

  @JsonKey(name: 'updated_at')
  final String? updatedAt;

  User({
    required this.id,
    this.userId,
    required this.name,
    required this.email,
    this.phone = '',
    required this.role,
    this.address = '',
    this.city = '',
    this.postalCode = '',
    this.country = '',
    this.profilePicture,
    this.createdAt,
    this.updatedAt,
  });

  /// Factory constructor for creating a User from JSON
  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

  /// Convert User to JSON
  Map<String, dynamic> toJson() => _$UserToJson(this);

  /// Create a copy of User with optional field overrides
  User copyWith({
    int? id,
    int? userId,
    String? name,
    String? email,
    String? phone,
    String? role,
    String? address,
    String? city,
    String? postalCode,
    String? country,
    String? profilePicture,
    String? createdAt,
    String? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      address: address ?? this.address,
      city: city ?? this.city,
      postalCode: postalCode ?? this.postalCode,
      country: country ?? this.country,
      profilePicture: profilePicture ?? this.profilePicture,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Check if user is a customer
  bool get isCustomer => role.toLowerCase() == 'customer';

  /// Check if user is staff
  bool get isStaff => role.toLowerCase() == 'staff';

  /// Check if user is admin
  bool get isAdmin => role.toLowerCase() == 'admin';

  @override
  String toString() => 'User(id: $id, name: $name, email: $email, role: $role)';
}
