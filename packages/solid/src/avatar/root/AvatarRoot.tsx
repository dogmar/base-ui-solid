import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarRoot(componentProps: AvatarRoot.Props): JSX.Element {
  const elementProps = omit(componentProps, 'className', 'class', 'render', 'style', 'ref');

  const [imageLoadingStatus, setImageLoadingStatus] = createSignal<ImageLoadingStatus>('idle', {
    ownedWrite: true,
  });

  const state: AvatarRootState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const contextValue: AvatarRootContext = {
    imageLoadingStatus,
    setImageLoadingStatus,
  };

  return (
    <AvatarRootContext value={contextValue}>
      {useRenderElement('span', componentProps, {
        state,
        props: [elementProps],
        stateAttributesMapping: avatarStateAttributesMapping,
      })}
    </AvatarRootContext>
  );
}

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps extends BaseUIComponentProps<'span', AvatarRootState> {}

export namespace AvatarRoot {
  export type State = AvatarRootState;
  export type Props = AvatarRootProps;
}
