import { createRenderEffect, createSignal, type Accessor } from 'solid-js';
import { NOOP } from '../../internals/noop';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

interface UseImageLoadingStatusOptions {
  // Non-string values are Solid attribute-removal/presence markers and are treated as absent.
  referrerpolicy?: string | boolean | undefined;
  crossorigin?: string | boolean | undefined;
  sizes?: string | boolean | undefined;
  srcset?: string | boolean | undefined;
}

export function useImageLoadingStatus(
  src: Accessor<string | undefined>,
  options: UseImageLoadingStatusOptions,
  enabled: Accessor<boolean>,
): [
  Accessor<ImageLoadingStatus>,
  (value: ImageLoadingStatus | ((prev: ImageLoadingStatus) => ImageLoadingStatus)) => void,
] {
  const [loadingStatus, setLoadingStatus] = createSignal<ImageLoadingStatus>('idle', {
    ownedWrite: true,
  });

  createRenderEffect(
    () => ({
      enabled: enabled(),
      src: src(),
      srcSet: options.srcset,
      sizes: options.sizes,
      crossOrigin: options.crossorigin,
      referrerPolicy: options.referrerpolicy,
    }),
    (current) => {
      if (!current.enabled) {
        return NOOP;
      }

      if (!current.src && !current.srcSet) {
        setLoadingStatus('error');
        return NOOP;
      }

      let isMounted = true;
      const image = new window.Image();

      const updateStatus = (status: ImageLoadingStatus) => () => {
        if (!isMounted) {
          return;
        }

        setLoadingStatus(status);
      };

      setLoadingStatus('loading');
      image.onload = updateStatus('loaded');
      image.onerror = updateStatus('error');
      if (typeof current.referrerPolicy === 'string' && current.referrerPolicy) {
        image.referrerPolicy = current.referrerPolicy;
      }
      image.crossOrigin = typeof current.crossOrigin === 'string' ? current.crossOrigin : null;
      if (typeof current.sizes === 'string' && current.sizes) {
        image.sizes = current.sizes;
      }
      if (typeof current.srcSet === 'string' && current.srcSet) {
        image.srcset = current.srcSet;
      }
      if (current.src) {
        image.src = current.src;
      }

      // Fast path for cached/decoded images
      if (image.complete) {
        setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
      }

      return () => {
        isMounted = false;
      };
    },
  );

  return [loadingStatus, setLoadingStatus];
}
