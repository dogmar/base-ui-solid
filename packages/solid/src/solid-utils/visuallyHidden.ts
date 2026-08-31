import type { JSX } from '@solidjs/web';

/**
 * Solid-flavored copies of the `visuallyHidden` style constants from
 * `@base-ui/utils/visuallyHidden`. Solid style objects use hyphenated keys and
 * do not auto-append `px` to numeric values, so the React constants cannot be
 * imported directly.
 */
const visuallyHiddenBase: JSX.CSSProperties = {
  'clip-path': 'inset(50%)',
  overflow: 'hidden',
  'white-space': 'nowrap',
  border: '0',
  padding: '0',
  width: '1px',
  height: '1px',
  margin: '-1px',
};

export const visuallyHidden: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'fixed',
  top: '0',
  left: '0',
};

export const visuallyHiddenInput: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};
