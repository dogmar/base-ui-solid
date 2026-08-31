import '@testing-library/jest-dom/vitest';

// jsdom does not implement PointerEvent; Base UI dispatches constructed
// pointer events (e.g. `dispatchClickWithModifiers`), so polyfill it with a
// MouseEvent subclass, mirroring @mui/internal-test-utils.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;

    pointerType: string;

    isPrimary: boolean;

    width: number;

    height: number;

    pressure: number;

    tiltX: number;

    tiltY: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? false;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
    }
  }

  (globalThis as any).PointerEvent = PointerEventPolyfill;
}
