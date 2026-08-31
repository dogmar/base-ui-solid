import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Avatar } from '..';

type MockImage = {
  complete: boolean;
  naturalWidth: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  referrerPolicy: string;
  crossOrigin: string | null;
  sizes: string;
  src: string;
  srcset: string;
};

/**
 * When `completeOnSet` is true, simulates cached-image behavior: setting a
 * source immediately marks the image as complete before an async load event.
 */
function mockImageLoading({ completeOnSet = false, naturalWidth = 100 } = {}) {
  const OriginalImage = window.Image;
  const images: MockImage[] = [];

  window.Image = function MockImageConstructor() {
    let srcValue = '';
    let srcSetValue = '';
    const obj: MockImage = {
      complete: false,
      naturalWidth: 0,
      onload: null,
      onerror: null,
      referrerPolicy: '',
      crossOrigin: null,
      sizes: '',
      get src() {
        return srcValue;
      },
      set src(value: string) {
        srcValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
      get srcset() {
        return srcSetValue;
      },
      set srcset(value: string) {
        srcSetValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
    };
    images.push(obj);
    return obj;
  } as unknown as typeof window.Image;

  return {
    images,
    restore() {
      window.Image = OriginalImage;
    },
  };
}

describe('<Avatar.Image />', () => {
  let restoreImage: () => void;

  function installImageMock(options?: Parameters<typeof mockImageLoading>[0]) {
    restoreImage();
    const imageMock = mockImageLoading(options);
    restoreImage = imageMock.restore;
    return imageMock;
  }

  beforeEach(() => {
    restoreImage = mockImageLoading({ completeOnSet: true }).restore;
  });

  afterEach(() => {
    restoreImage();
  });

  it('passes native image props to the rendered image', () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image
          crossorigin="anonymous"
          data-testid="image"
          referrerpolicy="no-referrer"
          sizes="48px"
          src="avatar.png"
          srcset="avatar.png 1x, avatar@2x.png 2x"
        />
      </Avatar.Root>
    ));
    flush();

    const image = screen.getByTestId('image');
    expect(image).toHaveAttribute('crossorigin', 'anonymous');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('sizes', '48px');
    expect(image).toHaveAttribute('srcset', 'avatar.png 1x, avatar@2x.png 2x');
  });

  it('shows the image when only srcset is provided', () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" sizes="48px" srcset="avatar.png 1x" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();

    expect(screen.getByTestId('image')).toHaveAttribute('srcset', 'avatar.png 1x');
    expect(screen.queryByText('JD')).toBe(null);
  });

  it('passes responsive image props to the loading probe', () => {
    const imageMock = installImageMock();

    render(() => (
      <Avatar.Root>
        <Avatar.Image sizes="48px" src="fallback.png" srcset="avatar.png 1x, avatar@2x.png 2x" />
      </Avatar.Root>
    ));
    flush();

    expect(imageMock.images[0].sizes).toBe('48px');
    expect(imageMock.images[0].srcset).toBe('avatar.png 1x, avatar@2x.png 2x');
    expect(imageMock.images[0].src).toBe('fallback.png');
  });

  describe('prop: onLoadingStatusChange', () => {
    it('fires when the image loads', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>
      ));
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      imageMock.images.at(-1)?.onload?.();
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'loaded',
        ]);
      });
    });

    it('fires when the image errors', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>
      ));
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      imageMock.images.at(-1)?.onerror?.();
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'error',
        ]);
      });
    });

    it('fires for cached image errors without emitting idle', async () => {
      installImageMock({ completeOnSet: true, naturalWidth: 0 });
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>
      ));
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      });

      expect(onLoadingStatusChange).not.toHaveBeenCalledWith('idle');
    });
  });

  describe('prop: keepMounted', () => {
    it('mounts the image while loading without preloading it', async () => {
      const imageMock = installImageMock();

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.getByTestId('image')).toHaveAttribute('src', 'avatar.png');
      expect(screen.getByText('JD')).not.toBe(null);
      expect(imageMock.images.length).toBe(0);
    });

    it('derives the status from the rendered element load event', async () => {
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src="avatar.png"
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'loaded',
      ]);
    });

    it('keeps the image mounted when it fails to load', async () => {
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src="avatar.png"
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.error(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'error',
      ]);
      expect(screen.getByTestId('image')).not.toBe(null);
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('calls the user onError handler', async () => {
      const onError = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" onError={onError} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.error(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('calls the user onLoad handler', async () => {
      const onLoad = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" onLoad={onLoad} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
    });

    it('lets a user handler prevent the status update', async () => {
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            onLoad={(event) => event.preventBaseUIHandler()}
            onLoadingStatusChange={onLoadingStatusChange}
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.load(screen.getByTestId('image'));
      flush();

      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');
      expect(screen.getByText('JD')).not.toBe(null);
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(['loading']);
    });

    it('resets the status when the src prop changes', async () => {
      const onLoadingStatusChange = vi.fn();
      const [src, setSrc] = createSignal('avatar-1.png');

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src={src()}
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      onLoadingStatusChange.mockClear();

      setSrc('avatar-2.png');
      flush();

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });
      expect(screen.getByText('JD')).not.toBe(null);

      // The reset status must be able to resolve again from the new load.
      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'loaded',
      ]);
    });

    it('hides the image from assistive technology until it loads', async () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      // Only the fallback names the avatar while both are in the DOM.
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('img')).toBe(null);

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('aria-hidden');
      });
      expect(screen.getByRole('img', { name: 'Jane Doe' })).not.toBe(null);
    });

    it('keeps the image hidden from assistive technology after an error', async () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.error(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-error');
      });
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('hides the image from assistive technology again when the source changes', async () => {
      const [src, setSrc] = createSignal('avatar-1.png');

      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src={src()} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('aria-hidden');
      });

      setSrc('avatar-2.png');
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('preserves an explicitly provided aria-hidden value', async () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image
            alt="Jane Doe"
            aria-hidden="false"
            data-testid="image"
            keepMounted
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'false');

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'false');
    });

    it('marks the not-loaded states with data attributes', async () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');

      fireEvent.load(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('data-loading');
      });
      expect(screen.getByTestId('image')).not.toHaveAttribute('data-error');

      fireEvent.error(screen.getByTestId('image'));
      flush();

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-error');
      });
    });

    it('does not override source props in a render callback', () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image
            keepMounted
            render={(props) => (
              <img
                alt=""
                data-testid="image"
                sizes="48px"
                src="avatar.png"
                srcset="avatar.png 1x"
                {...props}
              />
            )}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      const image = screen.getByTestId('image');
      expect(image).toHaveAttribute('sizes', '48px');
      expect(image).toHaveAttribute('src', 'avatar.png');
      expect(image).toHaveAttribute('srcset', 'avatar.png 1x');
    });

    it('applies the source props after the ones configuring the request', () => {
      let keys: string[] = [];

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            keepMounted
            src="avatar.png"
            loading="lazy"
            sizes="48px"
            srcset="avatar.png 1x, avatar@2x.png 2x"
            render={(props) => {
              keys = Object.keys(props);
              return <img alt="" {...props} />;
            }}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      // Some browsers start fetching as soon as `src` lands. Anything configuring that
      // request has to be applied before it.
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('loading'));
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('sizes'));
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('srcset'));
    });
  });

  it('shows the image immediately for a cached src', () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image src="https://example.com/cached-avatar.png" alt="Jane Doe" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cached-avatar.png');
    expect(screen.queryByText('JD')).toBe(null);
  });
});
