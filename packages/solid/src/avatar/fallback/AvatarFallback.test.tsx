import { Mock } from 'vitest';
import { Show, createSignal, flush, type Accessor } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { Avatar } from '..';
import { useImageLoadingStatus } from '../image/useImageLoadingStatus';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

vi.mock('../image/useImageLoadingStatus');

function mockLoadingStatus(getStatus: (src: string | undefined) => ImageLoadingStatus) {
  (useImageLoadingStatus as Mock).mockImplementation((src: Accessor<string | undefined>) => [
    () => getStatus(src()),
    () => {},
  ]);
}

describe('<Avatar.Fallback />', () => {
  beforeEach(() => {
    // The component destructures the hook's return value, so every test needs a stub in place.
    mockLoadingStatus(() => 'idle');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a span', () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));
    expect(screen.getByTestId('fallback').tagName).toBe('SPAN');
  });

  it('should not render the children if the image loaded', async () => {
    mockLoadingStatus(() => 'loaded');

    render(() => (
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback data-testid="fallback" />
      </Avatar.Root>
    ));
    flush();

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
  });

  it('should render the fallback if the image fails to load', async () => {
    mockLoadingStatus(() => 'error');

    render(() => (
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback>AC</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();

    await waitFor(() => {
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('shows the fallback when a loaded image is unmounted', async () => {
    mockLoadingStatus(() => 'loaded');

    const [showImage, setShowImage] = createSignal(true);

    render(() => (
      <Avatar.Root>
        <Show when={showImage()}>
          <Avatar.Image data-testid="image" src="avatar.png" />
        </Show>
        <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
    expect(screen.getByTestId('image')).not.toBe(null);

    setShowImage(false);
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('fallback')).not.toBe(null);
    });
    expect(screen.queryByTestId('image')).toBe(null);
  });

  describe('prop: delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the fallback when the delay has elapsed', () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={100}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.queryByText('AC')).toBe(null);

      vi.advanceTimersByTime(100);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('shows the fallback immediately when delay is 0', () => {
      mockLoadingStatus(() => 'error');

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={0}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      // No timers are advanced: `delay={0}` must render synchronously on mount.
      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('shows the fallback when delay changes to 0', () => {
      mockLoadingStatus(() => 'error');

      const [delay, setDelay] = createSignal<number | undefined>(100);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.queryByText('AC')).toBe(null);

      setDelay(0);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible when delay changes from undefined to a number', () => {
      mockLoadingStatus(() => 'error');

      const [delay, setDelay] = createSignal<number | undefined>(undefined);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);

      setDelay(100);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible across a number -> undefined -> number delay change', () => {
      mockLoadingStatus(() => 'error');

      const [delay, setDelay] = createSignal<number | undefined>(100);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));
      flush();

      // Fallback is hidden until the delay elapses.
      expect(screen.queryByText('AC')).toBe(null);

      // Removing the delay before it elapses shows the fallback immediately.
      setDelay(undefined);
      flush();
      expect(screen.queryByText('AC')).not.toBe(null);

      // Restoring the delay must not re-hide the already-visible fallback.
      setDelay(100);
      flush();
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('keeps fallback mounted and image unmounted while the image is loading', async () => {
    mockLoadingStatus((src) => (src ? 'loading' : 'error'));

    const [showImage, setShowImage] = createSignal(false);

    render(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" src={showImage() ? 'avatar.png' : undefined} />
        <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);

    setShowImage(true);
    flush();

    await waitFor(() => {
      expect(screen.queryByTestId('image')).toBe(null);
    });
    await waitFor(() => {
      expect(screen.getByTestId('fallback')).not.toBe(null);
    });
  });
});
