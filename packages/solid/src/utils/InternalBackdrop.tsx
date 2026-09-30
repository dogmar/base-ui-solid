import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { applyRef, type RefInput } from '../solid-utils/refs';

/**
 * @internal
 */
export function InternalBackdrop(props: InternalBackdrop.Props): JSX.Element {
  const otherProps = omit(props, 'cutout', 'ref');

  const clipPath = (): string | undefined => {
    const cutout = props.cutout;
    if (!cutout) {
      return undefined;
    }
    const rect = cutout.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  };

  const setRef = (el: HTMLDivElement | null) => {
    applyRef(props.ref, el);
  };
  onCleanup(() => setRef(null));

  return (
    <div
      ref={setRef}
      role="presentation"
      // Ensures Floating UI's outside press detection runs, as it considers
      // it an element that existed when the popup rendered.
      data-base-ui-inert=""
      {...otherProps}
      style={{
        position: 'fixed',
        inset: '0',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'clip-path': clipPath(),
      }}
    />
  );
}

export interface InternalBackdropState {}

export interface InternalBackdropProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'ref' | 'style'> {
  /**
   * The element to cut out of the backdrop.
   * This is useful for allowing certain elements to be interactive while the backdrop is present.
   */
  cutout?: Element | null | undefined;
  ref?: RefInput<HTMLDivElement> | undefined;
  inert?: boolean | undefined;
}

export namespace InternalBackdrop {
  export type State = InternalBackdropState;
  export type Props = InternalBackdropProps;
}
