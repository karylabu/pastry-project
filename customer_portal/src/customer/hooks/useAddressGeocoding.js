import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useAddressGeocoding
 * -----------------------------------------------------------------------
 * A transport-agnostic hook that turns free-text address input into
 * lat/lng coordinates using OpenStreetMap's Nominatim search API.
 *
 * It knows nothing about Leaflet or your map — it just gives you:
 *   - a debounced "as you type" search
 *   - an imperative geocodeNow() you can call on blur / button click
 *   - status + error state you can render
 *   - a `result` object your component reacts to (e.g. move a marker)
 *
 * Usage:
 *   const {
 *     setSearchTerm, geocodeNow, result, status, errorMessage, reset,
 *   } = useAddressGeocoding({ biasBounds: TANAUAN_BOUNDS, debounceMs: 700 });
 *
 *   <input onChange={(e) => setSearchTerm(e.target.value)} onBlur={() => geocodeNow()} />
 *
 *   useEffect(() => {
 *     if (result) { map.flyTo([result.lat, result.lon]); ... }
 *   }, [result]);
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// A friendly identifier is required by Nominatim's usage policy.
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
};

export const STATUS = {
  IDLE: "idle",
  SEARCHING: "searching",
  FOUND: "found",
  NOT_FOUND: "not_found",
  ERROR: "error",
};

/**
 * Builds a Nominatim `viewbox` string biased toward the given bounds.
 * We pad the box a bit so addresses just outside the delivery boundary
 * (which we still want to detect and reject) are found rather than
 * silently dropped by the bias.
 */
function buildViewbox(bounds, padding = 0.08) {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const left = minLng - padding;
  const right = maxLng + padding;
  const top = maxLat + padding;
  const bottom = minLat - padding;
  return `${left},${top},${right},${bottom}`;
}

export default function useAddressGeocoding({
  biasBounds,
  debounceMs = 700,
  countryCodes = "ph",
  minQueryLength = 5,
} = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [result, setResult] = useState(null); // { lat, lon, displayName, raw }
  const [errorMessage, setErrorMessage] = useState("");

  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const viewbox = biasBounds ? buildViewbox(biasBounds) : null;

  const reset = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setStatus(STATUS.IDLE);
    setResult(null);
    setErrorMessage("");
  }, []);

  const runGeocode = useCallback(
    async (query) => {
      const trimmed = (query ?? "").trim();

      if (trimmed.length < minQueryLength) {
        setStatus(STATUS.IDLE);
        setResult(null);
        setErrorMessage("");
        return null;
      }

      // Cancel any in-flight request so late responses can't clobber newer ones.
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = ++requestIdRef.current;

      setStatus(STATUS.SEARCHING);
      setErrorMessage("");

      const params = new URLSearchParams({
        q: trimmed,
        format: "json",
        addressdetails: "1",
        limit: "1",
      });

      if (countryCodes) params.set("countrycodes", countryCodes);
      // bounded=0: use the box to *bias* ranking rather than hard-restrict,
      // so we can still detect (and reject) real addresses outside the box.
      if (viewbox) {
        params.set("viewbox", viewbox);
        params.set("bounded", "0");
      }

      try {
        const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          headers: NOMINATIM_HEADERS,
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Geocoding request failed (${res.status})`);
        }

        const data = await res.json();

        // A newer request has since started — drop this stale response.
        if (requestId !== requestIdRef.current) return null;

        if (!Array.isArray(data) || data.length === 0) {
          setStatus(STATUS.NOT_FOUND);
          setResult(null);
          setErrorMessage(
            "Address not found. Please try a more specific address or pin it manually."
          );
          return null;
        }

        const match = data[0];
        const geocoded = {
          lat: parseFloat(match.lat),
          lon: parseFloat(match.lon),
          displayName: match.display_name,
          raw: match,
        };

        setStatus(STATUS.FOUND);
        setResult(geocoded);
        setErrorMessage("");
        return geocoded;
      } catch (err) {
        if (err.name === "AbortError") return null;
        if (requestId !== requestIdRef.current) return null;

        console.error("Geocoding error:", err);
        setStatus(STATUS.ERROR);
        setResult(null);
        setErrorMessage(
          "Couldn't reach the address search service. Please pin your location manually."
        );
        return null;
      }
    },
    [viewbox, countryCodes, minQueryLength]
  );

  // Debounced "as you type" search.
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!searchTerm || searchTerm.trim().length < minQueryLength) {
      setStatus(STATUS.IDLE);
      setResult(null);
      setErrorMessage("");
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      runGeocode(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, debounceMs, minQueryLength]);

  // Cleanup in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Imperative trigger for blur / button-press flows. Bypasses the debounce
  // and searches immediately using either the passed term or current state.
  const geocodeNow = useCallback(
    (query) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return runGeocode(query ?? searchTerm);
    },
    [runGeocode, searchTerm]
  );

  return {
    searchTerm,
    setSearchTerm,
    geocodeNow,
    result,
    status,
    isSearching: status === STATUS.SEARCHING,
    errorMessage,
    reset,
  };
}
