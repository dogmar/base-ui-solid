import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';

/**
 * Tracks a CSS media query. Solid port of `useMediaQuery`: returns a reactive
 * accessor instead of a plain boolean.
 */
export function useMediaQuery(query: string, options: useMediaQuery.Options): Accessor<boolean> {
  // Wait for jsdom to support the match media feature.
  // All the browsers Base UI support have this built-in.
  // This defensive check is here for simplicity.
  // Most of the time, the match media logic isn't central to people's tests.
  const supportMatchMedia =
    typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined';

  query = query.replace(/^@media( ?)/m, '');

  const {
    defaultMatches = false,
    matchMedia = supportMatchMedia ? window.matchMedia : null,
  } = options;

  if (matchMedia === null) {
    return () => defaultMatches;
  }

  const mediaQueryList = matchMedia(query);
  const [matches, setMatches] = createSignal(mediaQueryList.matches, { ownedWrite: true });

  const removeListener = addEventListener(mediaQueryList, 'change', () => {
    setMatches(mediaQueryList.matches);
  });
  onCleanup(removeListener);

  return matches;
}

export interface UseMediaQueryOptions {
  /**
   * As `window.matchMedia()` is unavailable on the server,
   * it returns a default matches during the first mount.
   * @default false
   */
  defaultMatches?: boolean | undefined;
  /**
   * You can provide your own implementation of matchMedia.
   * This can be used for handling an iframe content window.
   */
  matchMedia?: typeof window.matchMedia | undefined;
  /**
   * Kept for API parity with the React version; has no effect in the Solid
   * port (there is no double-pass hydration).
   * @default false
   */
  noSsr?: boolean | undefined;
  /**
   * You can provide your own implementation of `matchMedia`, it's used when rendering server-side.
   */
  ssrMatchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface UseMediaQueryState {}

export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}
