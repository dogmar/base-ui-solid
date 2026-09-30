import { omit, Show } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { platform } from '@base-ui/utils/platform';
import { ownerDocument } from '@base-ui/utils/owner';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useNumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';
import { useRenderElement } from '../../internals/useRenderElement';

const CURSOR_STYLE: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  'pointer-events': 'none',
};

/**
 * A custom element to display instead of the native cursor while using the scrub area.
 * Renders a `<span>` element.
 *
 * This component uses the [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), which may prompt the browser to display a related notification. It is disabled
 * in Safari to avoid a layout shift that this notification causes there.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldScrubAreaCursor(
  componentProps: NumberFieldScrubAreaCursor.Props,
): JSX.Element {
  const { state } = useNumberFieldRootContext();
  const { isScrubbing, isTouchInput, isPointerLockDenied, scrubAreaCursorRef } =
    useNumberFieldScrubAreaContext();

  const shouldRender = () =>
    isScrubbing() && !platform.engine.webkit && !isTouchInput() && !isPointerLockDenied();

  return (
    <Show when={shouldRender()}>
      <Portal mount={ownerDocument(scrubAreaCursorRef.current).body}>
        {useRenderElement('span', componentProps, {
          ref: [componentProps.ref, scrubAreaCursorRef],
          state,
          props: [
            {
              role: 'presentation',
              style: CURSOR_STYLE,
            },
            omit(componentProps, 'render', 'className', 'class', 'style', 'ref'),
          ],
          stateAttributesMapping,
        })}
      </Portal>
    </Show>
  );
}

export interface NumberFieldScrubAreaCursorState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaCursorProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubAreaCursorState
> {}

export namespace NumberFieldScrubAreaCursor {
  export type State = NumberFieldScrubAreaCursorState;
  export type Props = NumberFieldScrubAreaCursorProps;
}
