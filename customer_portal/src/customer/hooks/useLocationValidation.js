/**
 * Custom Hook: useLocationValidation
 * Manages location validation, boundary checking, and user feedback
 */

import { useState, useCallback } from 'react';
import {
  isLocationWithinCoverage,
  getOutOfCoverageMessage,
  getDistanceToCenter,
  validateCoordinates,
} from '../utils/locationBoundaryUtils';

export const useLocationValidation = () => {
  const [validationState, setValidationState] = useState({
    isValid: false,
    lat: null,
    lng: null,
    address: '',
    errorMessage: '',
    distanceFromCenter: null,
    showOutOfCoverageModal: false,
  });

  /**
   * Validate and set location
   * Returns true if valid, false if out of coverage
   */
  const validateLocation = useCallback((lat, lng, address = '') => {
    // Sanitize coordinates
    const coordValidation = validateCoordinates(lat, lng);
    if (!coordValidation.valid) {
      setValidationState((prev) => ({
        ...prev,
        isValid: false,
        errorMessage: coordValidation.error,
        showOutOfCoverageModal: true,
      }));
      return false;
    }

    // Check coverage
    const isWithinCoverage = isLocationWithinCoverage(lat, lng);
    const distanceKm = getDistanceToCenter(lat, lng);

    if (!isWithinCoverage) {
      const outOfCoverageMsg = getOutOfCoverageMessage(lat, lng);
      setValidationState((prev) => ({
        ...prev,
        isValid: false,
        lat,
        lng,
        address,
        errorMessage: outOfCoverageMsg,
        distanceFromCenter: distanceKm,
        showOutOfCoverageModal: true,
      }));
      return false;
    }

    // Valid location
    setValidationState((prev) => ({
      ...prev,
      isValid: true,
      lat,
      lng,
      address,
      errorMessage: '',
      distanceFromCenter: distanceKm,
      showOutOfCoverageModal: false,
    }));
    return true;
  }, []);

  /**
   * Clear validation and close modal
   */
  const clearValidation = useCallback(() => {
    setValidationState((prev) => ({
      ...prev,
      showOutOfCoverageModal: false,
    }));
  }, []);

  /**
   * Reset to initial state
   */
  const resetValidation = useCallback(() => {
    setValidationState({
      isValid: false,
      lat: null,
      lng: null,
      address: '',
      errorMessage: '',
      distanceFromCenter: null,
      showOutOfCoverageModal: false,
    });
  }, []);

  return {
    validationState,
    validateLocation,
    clearValidation,
    resetValidation,
    isLocationValid: validationState.isValid,
    errorMessage: validationState.errorMessage,
    showOutOfCoverageModal: validationState.showOutOfCoverageModal,
  };
};

export default useLocationValidation;
