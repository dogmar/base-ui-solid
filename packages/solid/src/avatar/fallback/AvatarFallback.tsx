import { createEffect, createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTimeout } from '../../solid-utils/timers';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarFallback(componentProps: AvatarFallback.Props): JSX.Element {
  const elementProps = omit(componentProps, 'className', 'class', 'render', 'delay', 'style', 'ref');

  const delay = () => componentProps.delay ?? 0;

  const { imageLoadingStatus } = useAvatarRootContext();
  const [delayPassed, setDelayPassed] = createSignal(untrack(() => delay() === 0), {
    ownedWrite: true,
  });
  const timeout = useTimeout();

  createEffect(
    () => delay(),
    (currentDelay) => {
      if (currentDelay > 0) {
        timeout.start(currentDelay, () => setDelayPassed(true));
      } else {
        // Once the fallback is shown without a delay, keep it visible. Otherwise a later
        // change from no delay to a number would re-hide an already-visible fallback.
        setDelayPassed(true);
      }
      return timeout.clear;
    },
  );

  const state: AvatarFallbackState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  return useRenderElement('span', componentProps, {
    state,
    props: [elementProps],
    stateAttributesMapping: avatarStateAttributesMapping,
    enabled: () => imageLoadingStatus() !== 'loaded' && (delay() === 0 || delayPassed()),
  });
}

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps extends BaseUIComponentProps<'span', AvatarFallbackState> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
