import { createSignal, omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { platform } from '@base-ui/utils/platform';
import { visuallyHidden } from '../solid-utils/visuallyHidden';
import { applyRef, type RefInput } from '../solid-utils/refs';

/**
 * Solid port of the React `FocusGuard`.
 * @internal
 */
export function FocusGuard(props: FocusGuard.Props): JSX.Element {
  const [role, setRole] = createSignal<'button' | undefined>(undefined, { ownedWrite: true });

  onSettled(() => {
    // Unlike NVDA and JAWS, VoiceOver's virtual cursor triggers `onFocus` as
    // it moves — but only on focusable/role-button elements through WebKit's
    // NSAccessibility path. Setting `role="button"` lets the focus trap catch
    // the cursor.
    if (platform.screenReader.voiceOver && platform.engine.webkit) {
      setRole('button');
    }
  });

  const elementProps = omit(props, 'ref');

  return (
    <span
      {...elementProps}
      ref={(el: HTMLSpanElement | null) => applyRef(props.ref, el)}
      style={visuallyHidden}
      aria-hidden={role() ? undefined : 'true'}
      tabindex="0"
      role={role()}
      data-base-ui-focus-guard=""
    />
  );
}

export namespace FocusGuard {
  export type Props = Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'ref' | 'aria-hidden' | 'role'> & {
    ref?: RefInput<HTMLSpanElement> | undefined;
  };
}
