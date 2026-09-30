import { createEffect, createRenderEffect, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState, ImageLoadingStatus } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { createRef } from '../../solid-utils/refs';
import { useImageLoadingStatus } from './useImageLoadingStatus';

const stateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarImage(componentProps: AvatarImage.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'render',
    'onLoadingStatusChange',
    'keepMounted',
    'style',
    'ref',
    // Split out so they can be applied after every other prop: some browsers start fetching as
    // soon as `src` lands, ignoring a `loading` or `srcset` that arrives after it.
    'sizes',
    'srcset',
    'src',
  );

  const keepMounted = () => componentProps.keepMounted ?? false;

  const { setImageLoadingStatus: setRootImageLoadingStatus } = useAvatarRootContext();
  const [imageLoadingStatus, setImageLoadingStatus] = useImageLoadingStatus(
    () => componentProps.src || undefined,
    componentProps,
    () => !keepMounted(),
  );

  const isVisible = () => imageLoadingStatus() === 'loaded';
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(isVisible);

  const imageRef = createRef<HTMLImageElement>();
  let initialCommit = true;

  // With `keepMounted`, the status comes from the rendered element itself, whose `load` event may
  // have already fired (cached images, or loads completed before the first commit).
  createEffect(
    () => ({
      keepMounted: keepMounted(),
      src: componentProps.src,
      srcset: componentProps.srcset,
      sizes: componentProps.sizes,
      crossorigin: componentProps.crossorigin,
      referrerpolicy: componentProps.referrerpolicy,
      render: componentProps.render,
    }),
    (current) => {
      if (!current.keepMounted) {
        return;
      }

      const isInitialCommit = initialCommit;
      initialCommit = false;

      const image = imageRef.current;
      if (!image) {
        // The `render` element didn't forward the ref. Its own `load`/`error` events remain the
        // only source of truth, so don't overwrite the status they already reported.
        return;
      }

      if (!image.complete) {
        setImageLoadingStatus('loading');
        return;
      }

      const status = image.naturalWidth > 0 ? 'loaded' : 'error';
      setImageLoadingStatus(status);

      // An image that's already complete on the first commit was painted before this code ran, so
      // mount it without going through `'starting'` to avoid replaying the enter animation.
      if (status === 'loaded' && isInitialCommit) {
        setMounted(true);
      }
    },
  );

  const renderedStatusProps = {
    // Presence no longer implies the image loaded, so the not-loaded states need their own
    // styling hooks. Scoped to `keepMounted` so the default mode, where the element only
    // exists once loaded, doesn't pick them up while it animates out.
    get 'data-loading'() {
      return keepMounted() && imageLoadingStatus() === 'loading' ? '' : undefined;
    },
    get 'data-error'() {
      return keepMounted() && imageLoadingStatus() === 'error' ? '' : undefined;
    },
    // Until the image is displayable, the fallback owns the accessible name; without this
    // both would be exposed to assistive technology at once.
    get 'aria-hidden'() {
      return keepMounted() && imageLoadingStatus() !== 'loaded' ? 'true' : undefined;
    },
    onLoad() {
      if (keepMounted()) {
        setImageLoadingStatus('loaded');
      }
    },
    onError() {
      if (keepMounted()) {
        setImageLoadingStatus('error');
      }
    },
  };

  const handleLoadingStatusChange = (status: ImageLoadingStatus) => {
    componentProps.onLoadingStatusChange?.(status);
    setRootImageLoadingStatus(status);
  };

  createRenderEffect(
    () => imageLoadingStatus(),
    (status) => {
      if (status !== 'idle') {
        handleLoadingStatusChange(status);
      }
    },
  );

  onCleanup(() => {
    setRootImageLoadingStatus('idle');
  });

  useOpenChangeComplete({
    get enabled() {
      return !isVisible();
    },
    get open() {
      return isVisible();
    },
    ref: imageRef,
    onComplete() {
      if (!isVisible()) {
        setMounted(false);
      }
    },
  });

  const state: AvatarImageState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
    // The element never unmounts with `keepMounted`, so an exit transition would play and then
    // reverse itself once the status is cleared. `data-loading`/`data-error` cover that state.
    get transitionStatus() {
      return keepMounted() && transitionStatus() === 'ending' ? undefined : transitionStatus();
    },
  };

  const shouldRender = () => keepMounted() || mounted();

  const sourceProps = (props: HTMLProps): HTMLProps => {
    const withSource: HTMLProps = { ...props };
    if (componentProps.sizes !== undefined) {
      withSource.sizes = componentProps.sizes;
    }
    if (componentProps.srcset !== undefined) {
      withSource.srcset = componentProps.srcset;
    }
    if (componentProps.src !== undefined) {
      withSource.src = componentProps.src;
    }
    return withSource;
  };

  return useRenderElement('img', componentProps, {
    state,
    ref: imageRef,
    props: [renderedStatusProps, elementProps, sourceProps],
    stateAttributesMapping,
    enabled: shouldRender,
  });
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps extends BaseUIComponentProps<
  'img',
  AvatarImageState,
  JSX.IntrinsicElements['img']
> {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
  /**
   * Whether the image element stays mounted and loads in place instead of being preloaded.
   * Supports `loading="lazy"` and optimized image components.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace AvatarImage {
  export type State = AvatarImageState;
  export type Props = AvatarImageProps;
}
