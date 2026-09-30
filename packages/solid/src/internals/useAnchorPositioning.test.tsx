/* eslint-disable react/jsx-fragments */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onCleanup } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { useFloating } from '../floating-ui-react';
import { createRef } from '../solid-utils/refs';
import {
  useAnchorPositioningWithHook,
  type UseAnchorPositioningParameters,
} from './useAnchorPositioning';

const shiftSpy = vi.hoisted(() => vi.fn());

vi.mock('../floating-ui-react', async () => {
  const actual =
    await vi.importActual<typeof import('../floating-ui-react')>('../floating-ui-react');

  return {
    ...actual,
    shift: ((...args: Parameters<typeof actual.shift>) => {
      shiftSpy(...args);
      return actual.shift(...args);
    }) satisfies typeof actual.shift,
  };
});

function TestUseAnchorPositioning(props: { shift?: UseAnchorPositioningParameters['shift'] }) {
  const anchorRef = createRef<HTMLDivElement>();

  const positioning = useAnchorPositioningWithHook(
    {
      anchor: anchorRef,
      mounted: true,
      positionMethod: 'absolute',
      side: 'bottom',
      align: 'center',
      sideOffset: 0,
      alignOffset: 0,
      collisionBoundary: 'clipping-ancestors',
      collisionPadding: 5,
      sticky: false,
      arrowPadding: 5,
      disableAnchorTracking: false,
      keepMounted: false,
      collisionAvoidance: { fallbackAxisSide: 'none' },
      get shift() {
        return props.shift;
      },
    },
    useFloating,
  );

  onCleanup(() => positioning.refs.setFloating(null));

  return (
    <>
      <div
        ref={(el) => {
          anchorRef.current = el;
        }}
      >
        anchor
      </div>
      <div ref={(el) => positioning.refs.setFloating(el)}>floating</div>
    </>
  );
}

describe.skipIf(!isJSDOM)('useAnchorPositioning', () => {
  beforeEach(() => {
    shiftSpy.mockClear();
  });

  it('uses the visual viewport for shift by default', async () => {
    render(() => <TestUseAnchorPositioning />);
    await Promise.resolve();

    expect(shiftSpy).toHaveBeenCalled();
    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe(undefined);
  });

  it.each([
    { shift: { rootBoundary: 'layoutViewport' } as const, crossAxis: false },
    { shift: { crossAxis: true, rootBoundary: 'layoutViewport' } as const, crossAxis: true },
  ])('uses the configured shift options', async ({ shift, crossAxis }) => {
    render(() => <TestUseAnchorPositioning shift={shift} />);
    await Promise.resolve();

    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe('layoutViewport');
    expect(shiftSpy.mock.calls[0]?.[0].crossAxis).toBe(crossAxis);
  });
});
