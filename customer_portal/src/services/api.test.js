import { getUserFriendlyAuthError, parseJsonResponse } from './api';

const makeResponse = (body, status = 200) => ({
  status,
  text: async () => body,
});

describe('authentication response errors', () => {
  test('uses a friendly message when the server returns HTML instead of JSON', async () => {
    await expect(
      parseJsonResponse(makeResponse('<!DOCTYPE html><html></html>'), "We couldn't sign you in.")
    ).rejects.toThrow("We couldn't sign you in.");
  });

  test('explains rate limits without exposing server text', () => {
    expect(getUserFriendlyAuthError(makeResponse('Too Many Attempts.', 429), null, 'Try again.'))
      .toBe('Too many sign-in attempts. Please wait 15 minutes, then try again.');
  });

  test('replaces technical server output with the provided friendly message', () => {
    expect(getUserFriendlyAuthError(
      makeResponse(''),
      { message: 'SQLSTATE[HY000]: database connection failed' },
      "We couldn't sign you in."
    )).toBe("We couldn't sign you in.");
  });

  test('provides clear guidance for an active admin session', () => {
    expect(getUserFriendlyAuthError(
      makeResponse('', 409),
      { code: 'ADMIN_SESSION_ACTIVE' },
      "We couldn't sign you in."
    )).toContain('active in another browser or device');
  });

  test('preserves safe validation messages from the server', () => {
    expect(getUserFriendlyAuthError(
      makeResponse('', 422),
      { message: 'Incorrect password. Please try again.' },
      "We couldn't sign you in."
    )).toBe('Incorrect password. Please try again.');
  });
});
