import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { Toast } from '..';

describe('<Toast.Arrow />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // The React suite's `mirrors the resolved side of its positioner` test
  // requires real layout measurements and is not ported to the jsdom run.

  it('throws a descriptive error when rendered outside <Toast.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => {
        render(() => (
          <Toast.Provider>
            <Toast.Arrow />
          </Toast.Provider>
        ));
      }).toThrow(
        'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
