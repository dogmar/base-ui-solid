import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { ImageLoadingStatus } from './AvatarRoot';

export interface AvatarRootContext {
  imageLoadingStatus: Accessor<ImageLoadingStatus>;
  setImageLoadingStatus: (
    value: ImageLoadingStatus | ((prev: ImageLoadingStatus) => ImageLoadingStatus),
  ) => void;
}

export const AvatarRootContext = createOptionalContext<AvatarRootContext>();

export function useAvatarRootContext() {
  const context = useOptionalContext(AvatarRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.',
    );
  }
  return context;
}
