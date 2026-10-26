// src/services/api.js
import { CUSTOMER_BASE } from './config';

const BASE_URL = CUSTOMER_BASE;

export function getAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = user?.token || localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function parseJsonResponse(response, fallbackMessage) {
  if (!response) {
    throw new Error(fallbackMessage);
  }

  let text;
  try {
    text = await response.text();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!text.trim()) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function getUserFriendlyAuthError(response, payload, fallbackMessage) {
  if (response?.status === 429) {
    return 'Too many sign-in attempts. Please wait 15 minutes, then try again.';
  }

  if (response?.status >= 500) {
    return 'Sign-in is temporarily unavailable. Please try again in a few minutes.';
  }

  if (payload?.code === 'ADMIN_SESSION_ACTIVE') {
    return 'This admin account is active in another browser or device. Sign out there first, or contact your administrator for help.';
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const containsTechnicalDetails = /<[^>]+>|unexpected token|doctype|sqlstate|stack trace|exception|fatal error|syntaxerror|referenceerror|typeerror|undefined index|internal server error/i.test(message);

  return message && message.length <= 240 && !containsTechnicalDetails
    ? message
    : fallbackMessage;
}

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
      const response = await fetch(`${BASE_URL}/api/customer/products?action=list`);
      return await safeParseJson(response) || [];
    } catch (error) {
      console.error('API Error:', error);
      return [];
    }
  },
  // Add other centralized API helpers here
};