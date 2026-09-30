/**
 * Shared test helpers for the Solid port, resolved via the `#test-utils`
 * import map entry (mirroring the React package's `#test-utils`).
 */

export const isJSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
