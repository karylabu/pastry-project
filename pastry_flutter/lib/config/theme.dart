/// Application Theme Configuration
/// Implements Material Design 3 with custom pastry shop branding
/// Design tokens from React app: espresso #2B1B14, cream #FBF6EC, butter #F0B94D, cocoa #6B4A3A, jam #A8354A, leaf #4F7A52

import 'package:flutter/material.dart';

class AppTheme {
  // ─── Design Tokens (matching React app) ───────────────────────────
  static const Color espresso = Color(0xFF2B1B14);    // Primary dark color
  static const Color cream = Color(0xFFFBF6EC);       // Primary light/background
  static const Color butter = Color(0xFFF0B94D);      // Primary accent/buttons
  static const Color cocoa = Color(0xFF6B4A3A);       // Secondary text
  static const Color jam = Color(0xFFA8354A);         // Error/danger red
  static const Color leaf = Color(0xFF4F7A52);        // Success/positive green

  // ─── Neutral Colors ────────────────────────────────────────────────
  static const Color darkGrey = Color(0xFF4A4A4A);
  static const Color mediumGrey = Color(0xFF757575);
  static const Color lightGrey = Color(0xFFE8E8E8);
  static const Color veryLightGrey = Color(0xFFF5F5F5);
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);

  // ─── Light Theme ──────────────────────────────────────────────────
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      
      // Primary colors
      colorScheme: ColorScheme.light(
        primary: butter,
        onPrimary: espresso,
        secondary: cocoa,
        onSecondary: white,
        tertiary: leaf,
        onTertiary: white,
        error: jam,
        onError: white,
        surface: cream,
        onSurface: espresso,
        surfaceContainerHighest: veryLightGrey,
      ),

      // Scaffold & general background
      scaffoldBackgroundColor: cream,

      // App Bar Theme
      appBarTheme: AppBarTheme(
        backgroundColor: espresso,
        foregroundColor: cream,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: _bodyLarge.copyWith(
          color: cream,
          fontWeight: FontWeight.w600,
        ),
      ),

      // Card Theme
      cardTheme: CardThemeData(
        color: white,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: EdgeInsets.zero,
      ),

      // Input Decoration Theme
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: lightGrey, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: lightGrey, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: butter, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: jam, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: jam, width: 2),
        ),
        hintStyle: _bodySmall.copyWith(color: mediumGrey),
        labelStyle: _bodySmall.copyWith(color: cocoa),
        errorStyle: _bodySmall.copyWith(color: jam),
      ),

      // Button Themes
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: butter,
          foregroundColor: espresso,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          textStyle: _bodyMedium.copyWith(
            fontWeight: FontWeight.w600,
            letterSpacing: 0.08,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: espresso,
          side: const BorderSide(color: lightGrey, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          textStyle: _bodyMedium.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: butter,
          textStyle: _bodyMedium.copyWith(fontWeight: FontWeight.w600),
        ),
      ),

      // Text Themes
      textTheme: _buildTextTheme(),

      // Other components
      dividerTheme: DividerThemeData(
        color: lightGrey,
        thickness: 1,
        space: 16,
      ),

      // Floating Action Button
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: butter,
        foregroundColor: espresso,
        elevation: 4,
      ),

      // Snackbar Theme
      snackBarTheme: SnackBarThemeData(
        backgroundColor: espresso,
        contentTextStyle: _bodySmall.copyWith(color: white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),

      // Checkbox Theme
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color?>((states) {
          if (states.contains(WidgetState.selected)) return butter;
          return AppTheme.transparent;
        }),
        side: const BorderSide(color: lightGrey),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),

      // Radio Button Theme
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color?>((states) {
          if (states.contains(WidgetState.selected)) return butter;
          return lightGrey;
        }),
      ),
    );
  }

  // ─── Text Themes ──────────────────────────────────────────────────
  static TextTheme _buildTextTheme() {
    return TextTheme(
      displayLarge: _displayLarge,
      displayMedium: _displayMedium,
      displaySmall: _displaySmall,
      headlineLarge: _headlineLarge,
      headlineMedium: _headlineMedium,
      headlineSmall: _headlineSmall,
      titleLarge: _titleLarge,
      titleMedium: _titleMedium,
      titleSmall: _titleSmall,
      bodyLarge: _bodyLarge,
      bodyMedium: _bodyMedium,
      bodySmall: _bodySmall,
      labelLarge: _labelLarge,
      labelMedium: _labelMedium,
      labelSmall: _labelSmall,
    );
  }

  // Typography - Display
  static const TextStyle _displayLarge = TextStyle(
    fontSize: 57,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.25,
    height: 1.12,
    fontFamily: 'Inter',
  );

  static const TextStyle _displayMedium = TextStyle(
    fontSize: 45,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.16,
    fontFamily: 'Inter',
  );

  static const TextStyle _displaySmall = TextStyle(
    fontSize: 36,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.22,
    fontFamily: 'Inter',
  );

  // Typography - Headline
  static const TextStyle _headlineLarge = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.25,
    fontFamily: 'Inter',
  );

  static const TextStyle _headlineMedium = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
    height: 1.29,
    fontFamily: 'Inter',
  );

  static const TextStyle _headlineSmall = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
    height: 1.33,
    fontFamily: 'Inter',
  );

  // Typography - Title
  static const TextStyle _titleLarge = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
    height: 1.27,
    fontFamily: 'Inter',
  );

  static const TextStyle _titleMedium = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.15,
    height: 1.5,
    fontFamily: 'Inter',
  );

  static const TextStyle _titleSmall = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
    height: 1.43,
    fontFamily: 'Inter',
  );

  // Typography - Body
  static const TextStyle _bodyLarge = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.5,
    height: 1.5,
    fontFamily: 'Inter',
  );

  static const TextStyle _bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.25,
    height: 1.43,
    fontFamily: 'Inter',
  );

  static const TextStyle _bodySmall = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.4,
    height: 1.33,
    fontFamily: 'Inter',
  );

  // Typography - Label
  static const TextStyle _labelLarge = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
    height: 1.43,
    fontFamily: 'Inter',
  );

  static const TextStyle _labelMedium = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
    height: 1.33,
    fontFamily: 'Inter',
  );

  static const TextStyle _labelSmall = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
    height: 1.45,
    fontFamily: 'Inter',
  );

  // ─── Color Constants ──────────────────────────────────────────────
  static const Color transparent = Color(0x00000000);
  
  // Opacity helpers
  static Color withOpacity(Color color, double opacity) {
    return color.withValues(alpha: opacity);
  }
}

/// Extension on ColorScheme to add custom colors
extension AppColors on ColorScheme {
  Color get espresso => AppTheme.espresso;
  Color get cream => AppTheme.cream;
  Color get butter => AppTheme.butter;
  Color get cocoa => AppTheme.cocoa;
  Color get jam => AppTheme.jam;
  Color get leaf => AppTheme.leaf;
}
