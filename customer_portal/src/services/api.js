// src/services/api.js
import { CUSTOMER_BASE } from './config';

const BASE_URL = CUSTOMER_BASE;

export async function safeParseJson(response) {
  if (!response) {
    return {};
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Invalid JSON response:', error, text);
    // Return empty object instead of throwing so callers can handle gracefully.
    return {};
  }
}

export async function safeFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text ? `HTTP ${response.status}: ${text}` : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return await safeParseJson(response);
}

export const api = {
  getProducts: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api_products.php?action=list`);
      return await safeParseJson(response) || [];
    } catch (error) {
      console.error('API Error:', error);
      return [];
    }
  },
  // Add other centralized API helpers here
};
