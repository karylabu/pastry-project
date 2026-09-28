import {
  calculateDistance,
  isLocationWithinCoverage,
  isWithinTanauanCity,
  TANAUAN_CITY_BOUNDS,
} from './locationBoundaryUtils';

describe('Tanauan City delivery boundary', () => {
  test('accepts the Tanauan city center', () => {
    expect(isLocationWithinCoverage(14.0735, 121.0743)).toBe(true);
  });

  test('accepts the Tanauan eastern boundary beyond the old 8.5 km radius', () => {
    const latitude = 14.070054031000041;
    const longitude = 121.16116102;

    expect(calculateDistance(
      latitude,
      longitude,
      TANAUAN_CITY_BOUNDS.centerLat,
      TANAUAN_CITY_BOUNDS.centerLng
    )).toBeGreaterThan(8.5);
    expect(isWithinTanauanCity(latitude, longitude)).toBe(true);
  });

  test('rejects a location in Santo Tomas, Batangas', () => {
    expect(isLocationWithinCoverage(14.084245047812548, 121.16819875303133)).toBe(false);
  });

  test('rejects invalid coordinates', () => {
    expect(isLocationWithinCoverage(Number.NaN, 121.0743)).toBe(false);
  });
});