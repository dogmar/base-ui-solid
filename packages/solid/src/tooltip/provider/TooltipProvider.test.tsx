import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';
import { OPEN_DELAY } from '../utils/constants';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
}

describe.skipIf(!isJSDOM)('<Tooltip.Provider />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('prop: delay', () => {
    it('waits for the delay before showing the tooltip', async () => {
      render(() => (
        <Tooltip.Provider delay={10_000}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await settle();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1_000);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(9_000);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects delay=0', async () => {
      render(() => (
        <Tooltip.Provider delay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await settle();

      await tick(0);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects trigger delay prop over provider delay prop', async () => {
      render(() => (
        <Tooltip.Provider delay={10}>
          <Tooltip.Root>
            <Tooltip.Trigger delay={100} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await settle();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(99);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).not.toBe(null);
    });
  });

  describe('prop: closeDelay', () => {
    it('waits for the closeDelay before hiding the tooltip', async () => {
      render(() => (
        <Tooltip.Provider closeDelay={400}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await settle();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      fireEvent.mouseLeave(trigger);

      await settle();

      await tick(300);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(300);

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe('prop: closeDelay updates', () => {
    it('uses the latest closeDelay after the prop updates', async () => {
      const [closeDelay, setCloseDelay] = createSignal(400, { ownedWrite: true });

      render(() => (
        <Tooltip.Provider closeDelay={closeDelay()}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await settle();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      setCloseDelay(1000);
      await settle();

      fireEvent.mouseLeave(trigger);

      await settle();

      await tick(999);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe('prop: timeout', () => {
    function TwoTooltips(props: {
      timeout: number;
      providerDelay?: number;
      triggerDelay?: number;
    }) {
      return (
        <Tooltip.Provider delay={props.providerDelay ?? 100} timeout={props.timeout}>
          {['One', 'Two'].map((name) => (
            <Tooltip.Root>
              <Tooltip.Trigger delay={props.triggerDelay}>{name}</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>{`Content ${name}`}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </Tooltip.Provider>
      );
    }

    it('opens an adjacent tooltip instantly while the group is active', async () => {
      render(() => <TwoTooltips timeout={400} />);
      await settle();

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await settle();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await settle();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);
    });

    it('respects a trigger delay over delay=0 outside the instant phase', async () => {
      render(() => <TwoTooltips timeout={400} providerDelay={0} triggerDelay={100} />);
      await settle();

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await settle();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await settle();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);

      fireEvent.mouseLeave(second);
      await settle();
      await tick(400);

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await settle();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);
    });

    it('requires the full delay again once the timeout elapses', async () => {
      render(() => <TwoTooltips timeout={400} />);
      await settle();

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await settle();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      await settle();
      await tick(400);

      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await settle();

      expect(screen.queryByText('Content Two')).toBe(null);

      await tick(100);

      expect(screen.queryByText('Content Two')).not.toBe(null);
    });
  });
});
