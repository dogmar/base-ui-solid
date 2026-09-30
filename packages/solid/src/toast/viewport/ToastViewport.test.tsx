/* eslint-disable react/jsx-fragments */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { isJSDOM } from '#test-utils';
import { Toast } from '..';
import { List, Button } from '../utils/test-utils';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await settle();
}

async function click(element: Element) {
  fireEvent.click(element);
  await settle();
}

describe('<Toast.Viewport />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it.skipIf(!isJSDOM)(
    'rebinds owner-document listeners once across empty store cycles',
    async () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const iframeWindow = iframe.contentWindow;
      const iframeDocument = iframe.contentDocument;
      if (!iframeWindow || !iframeDocument) {
        throw new Error('Expected iframe window and document.');
      }
      const iframeGlobal = iframeWindow as Window & typeof globalThis;

      const portalContainer = iframeDocument.createElement('div');
      iframeDocument.body.appendChild(portalContainer);
      const addWindowListener = vi.spyOn(iframeWindow, 'addEventListener');
      const removeWindowListener = vi.spyOn(iframeWindow, 'removeEventListener');
      const addDocumentListener = vi.spyOn(iframeDocument, 'addEventListener');
      const removeDocumentListener = vi.spyOn(iframeDocument, 'removeEventListener');

      function Controls() {
        const manager = Toast.useToastManager();
        return (
          <>
            <button type="button" onClick={() => manager.add({ title: 'title' })}>
              add alternate toast
            </button>
            <button type="button" onClick={() => manager.close(manager.toasts[0]?.id)}>
              close alternate toast
            </button>
          </>
        );
      }

      try {
        render(() => (
          <Toast.Provider timeout={0}>
            <Portal mount={portalContainer}>
              <Toast.Viewport data-testid="alternate-viewport">
                <List />
              </Toast.Viewport>
            </Portal>
            <Controls />
          </Toast.Provider>
        ));
        await settle();

        const add = screen.getByRole('button', { name: 'add alternate toast' });
        const close = screen.getByRole('button', { name: 'close alternate toast' });

        await click(add);
        expect(iframeDocument.querySelector('[data-testid="root"]')).not.toBe(null);

        expect(addWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(
          1,
        );
        expect(addWindowListener.mock.calls.filter(([type]) => type === 'blur')).toHaveLength(1);
        expect(addWindowListener.mock.calls.filter(([type]) => type === 'focus')).toHaveLength(1);
        expect(
          addDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
        ).toHaveLength(1);

        iframeWindow.dispatchEvent(new iframeGlobal.KeyboardEvent('keydown', { key: 'F6' }));
        await settle();
        expect(iframeDocument.activeElement).toBe(
          iframeDocument.querySelector('[data-testid="alternate-viewport"]'),
        );

        await click(close);
        expect(iframeDocument.querySelector('[data-testid="root"]')).toBe(null);
        expect(removeWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(
          1,
        );
        expect(removeWindowListener.mock.calls.filter(([type]) => type === 'blur')).toHaveLength(
          1,
        );
        expect(removeWindowListener.mock.calls.filter(([type]) => type === 'focus')).toHaveLength(
          1,
        );
        expect(
          removeDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
        ).toHaveLength(1);

        await click(add);
        expect(iframeDocument.querySelector('[data-testid="root"]')).not.toBe(null);
        expect(addWindowListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(
          2,
        );
        expect(addWindowListener.mock.calls.filter(([type]) => type === 'blur')).toHaveLength(2);
        expect(addWindowListener.mock.calls.filter(([type]) => type === 'focus')).toHaveLength(2);
        expect(
          addDocumentListener.mock.calls.filter(([type]) => type === 'pointerdown'),
        ).toHaveLength(2);
      } finally {
        addWindowListener.mockRestore();
        removeWindowListener.mockRestore();
        addDocumentListener.mockRestore();
        removeDocumentListener.mockRestore();
        iframe.remove();
      }
    },
  );

  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => {
        render(() => <Toast.Viewport />);
      }).toThrow('Base UI: useToastManager must be used within <Toast.Provider>.');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('gets focused when F6 is pressed', async () => {
    const user = userEvent.setup();

    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await settle();
    await user.keyboard('{F6}');
    await settle();

    expect(screen.getByTestId('viewport')).toHaveFocus();
  });

  it('focuses first toast upon tab after viewport is focused', async () => {
    const user = userEvent.setup();

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await settle();
    await user.keyboard('{F6}');
    await settle();
    await user.keyboard('{Tab}');
    await settle();

    expect(screen.getByTestId('root')).toHaveFocus();
  });

  it('returns focus to previous element when pressing shift+Tab on first toast', async () => {
    const user = userEvent.setup();

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await settle();
    await user.keyboard('{F6}');
    await settle();
    await user.tab();
    await settle();
    await user.tab({ shift: true });
    await settle();

    expect(button).toHaveFocus();
  });

  it('returns focus to previous element when pressing shift+Tab on last toast', async () => {
    const user = userEvent.setup();

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);
    await settle();
    await user.click(button);
    await settle();

    await user.keyboard('{F6}');
    await settle();
    await user.tab(); // first toast
    await user.tab(); // first toast close button
    await user.tab(); // first toast action button
    await user.tab(); // last toast
    await user.tab(); // last toast close button
    await user.tab(); // last toast action button
    await user.tab();
    await settle();

    expect(button).toHaveFocus();
  });

  it('removes expanded on mouseleave when focus-visible not inside', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await click(button);
    const viewport = screen.getByTestId('viewport');

    // Native `mouseenter`/`mouseleave` do not bubble, so hovering a toast is
    // simulated on the viewport element that carries the listeners.
    fireEvent.mouseEnter(viewport);
    await settle();
    expect(viewport).toHaveAttribute('data-expanded');

    fireEvent.mouseLeave(viewport);
    await settle();
    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  it('keeps expanded on mouseleave when focus-visible is inside', async () => {
    const user = userEvent.setup();

    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);
    await settle();
    const viewport = screen.getByTestId('viewport');

    await user.keyboard('{F6}');
    await settle();
    await user.tab();
    await settle();

    fireEvent.mouseEnter(viewport);
    await settle();
    expect(viewport).toHaveAttribute('data-expanded');
    fireEvent.mouseLeave(viewport);
    await settle();
    expect(viewport).toHaveAttribute('data-expanded');
  });

  it('keeps expanded during an active touch swipe even if mouseleave fires', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    await click(button);

    const root = screen.getByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });
    Object.defineProperty(root, 'releasePointerCapture', {
      value: () => {},
      configurable: true,
    });

    fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    expect(viewport).toHaveAttribute('data-expanded');

    fireEvent.mouseLeave(viewport);
    await settle();

    expect(viewport).toHaveAttribute('data-expanded');

    fireEvent.pointerUp(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  it('keeps expanded when a touch swipe is canceled without leaving the viewport', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    await click(button);

    const root = screen.getByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });

    fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    expect(root).toHaveAttribute('data-swiping');
    expect(viewport).toHaveAttribute('data-expanded');

    fireEvent.pointerCancel(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    expect(root).not.toHaveAttribute('data-swiping');
    expect(viewport).toHaveAttribute('data-expanded');
  });

  it('collapses after a touch swipe is canceled if mouseleave already fired', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    await click(button);

    const root = screen.getByTestId('root');
    const viewport = screen.getByTestId('viewport');

    Object.defineProperty(root, 'setPointerCapture', {
      value: () => {},
      configurable: true,
    });

    fireEvent.pointerDown(root, {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    fireEvent.mouseLeave(viewport);
    fireEvent.pointerCancel(root, {
      clientX: 100,
      clientY: 120,
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await settle();

    expect(root).not.toHaveAttribute('data-swiping');
    expect(viewport).not.toHaveAttribute('data-expanded');
  });

  describe('timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('pauses timers when hovering', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      fireEvent.mouseEnter(screen.getByTestId('viewport'));
      await settle();

      await tick(5001);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('resumes timers when not hovering', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      const viewport = screen.getByTestId('viewport');
      fireEvent.mouseEnter(viewport);
      await settle();

      await tick(5000);

      fireEvent.mouseLeave(viewport);
      await settle();

      await tick(4999);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('pauses timers when the viewport is focused', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });
      await settle();

      await tick(5001);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('restores focus and resumes timers on shift+Tab out of the focused viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      button.focus();
      await click(button);
      fireEvent.keyDown(button, { key: 'F6' });
      await settle();

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);

      fireEvent.keyDown(viewport, { key: 'Tab', shiftKey: true });
      await settle();

      expect(button).toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps timers paused when shift+Tab returns focus inside the viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      button.focus();
      await click(button);

      // Pressing F6 from a control inside the toast makes the restore target
      // itself live inside the viewport.
      const close = document.querySelector('[aria-label="close-press"]') as HTMLElement;
      close.focus();
      await settle();
      fireEvent.keyDown(close, { key: 'F6' });
      await settle();

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();

      fireEvent.keyDown(viewport, { key: 'Tab', shiftKey: true });
      await settle();

      expect(close).toHaveFocus();

      await tick(5001);
      // Focus never left the viewport, so the toast must stay put.
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('keeps the viewport focused when Tab is pressed without shift', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      button.focus();
      await click(button);
      fireEvent.keyDown(button, { key: 'F6' });
      await settle();

      const viewport = screen.getByTestId('viewport');
      fireEvent.keyDown(viewport, { key: 'Tab' });
      await settle();

      // Forward Tab moves into the toasts, so the viewport must not hand focus back.
      expect(button).not.toHaveFocus();

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('collapses and resumes timers on a touch outside the viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      const viewport = screen.getByTestId('viewport');
      fireEvent.mouseEnter(viewport);
      await settle();

      expect(viewport).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);

      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      await settle();

      expect(viewport).not.toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('stays expanded on a touch inside the viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      const viewport = screen.getByTestId('viewport');
      fireEvent.mouseEnter(viewport);
      await settle();

      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      await settle();

      expect(viewport).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it('ignores a mouse pointerdown outside the viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      fireEvent.mouseEnter(screen.getByTestId('viewport'));
      await settle();

      // Only touch activity ends the paused interaction; a mouse press outside
      // is followed by a `mouseleave`, which handles the collapse instead.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await settle();

      expect(screen.getByTestId('viewport')).toHaveAttribute('data-expanded');

      await tick(5001);
      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it.skipIf(!isJSDOM)('resumes timers when the viewport is blurred', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });
      await settle();

      await tick(5001);

      button.focus();
      await settle();

      await tick(5001);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it.skipIf(!isJSDOM)('resumes timers when the window regains focus', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });

      await click(button);

      expect(screen.queryByTestId('root')).not.toBe(null);
      const blurListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'blur' && call[2] === true,
      )?.[1] as EventListener | undefined;
      const focusListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'focus' && call[2] === true,
      )?.[1] as EventListener | undefined;

      addEventListenerSpy.mockRestore();

      expect(blurListener).toBeDefined();
      expect(focusListener).toBeDefined();

      if (!blurListener || !focusListener) {
        throw new Error('Expected window focus and blur listeners to be registered.');
      }

      const blurEvent = new FocusEvent('blur');
      Object.defineProperty(blurEvent, 'composedPath', {
        value: () => [window],
      });

      const focusEvent = new FocusEvent('focus');
      Object.defineProperty(focusEvent, 'composedPath', {
        value: () => [window],
      });

      await tick(1000);

      blurListener(blurEvent);
      await settle();

      await tick(5000);

      expect(screen.queryByTestId('root')).not.toBe(null);

      focusListener(focusEvent);
      await settle();

      await tick(3999);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it.skipIf(!isJSDOM)('keeps timers paused on mouseleave while the window is blurred', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      await click(button);

      const viewport = screen.getByTestId('viewport');

      const blurListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'blur' && call[2] === true,
      )?.[1] as EventListener | undefined;
      addEventListenerSpy.mockRestore();

      if (!blurListener) {
        throw new Error('Expected window blur listener to be registered.');
      }

      const blurEvent = new FocusEvent('blur');
      Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

      // Hovering pauses the timer.
      fireEvent.mouseEnter(viewport);
      await settle();
      await tick(1000);

      // The window loses focus while still hovering.
      blurListener(blurEvent);
      await settle();

      // Leaving with the pointer must not resume the timer while the window is
      // blurred, otherwise the toast could expire off-screen.
      fireEvent.mouseLeave(viewport);
      await settle();
      await tick(10000);

      expect(screen.queryByTestId('root')).not.toBe(null);
    });

    it.skipIf(!isJSDOM)(
      'collapses a deferred mouseleave after a closing toast is removed while blurred',
      async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const animationsDisabled = (globalThis as Record<string, any>)
          .BASE_UI_ANIMATIONS_DISABLED;
        (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          function CloseNewestButton() {
            const manager = Toast.useToastManager();

            return (
              <button
                onClick={() => {
                  manager.close(manager.toasts[0]?.id);
                }}
              >
                close newest
              </button>
            );
          }

          render(() => (
            <Toast.Provider>
              <Toast.Viewport data-testid="viewport">
                <List />
              </Toast.Viewport>
              <Button />
              <CloseNewestButton />
            </Toast.Provider>
          ));
          await settle();

          const button = screen.getByRole('button', { name: 'add' });
          await click(button);
          await click(button);

          const viewport = screen.getByTestId('viewport');
          const newestRoot = screen.getAllByTestId('root')[0];
          let finishAnimation!: () => void;
          const animationFinished = new Promise<void>((resolve) => {
            finishAnimation = resolve;
          });

          Object.defineProperty(newestRoot, 'getAnimations', {
            value: () => [{ finished: animationFinished }],
            configurable: true,
          });

          fireEvent.mouseEnter(viewport);
          await settle();
          expect(viewport).toHaveAttribute('data-expanded');

          await click(screen.getByRole('button', { name: 'close newest' }));
          expect(newestRoot).toHaveAttribute('data-ending-style');

          const blurListener = addEventListenerSpy.mock.calls.find(
            (call) => call[0] === 'blur' && call[2] === true,
          )?.[1] as EventListener | undefined;

          if (!blurListener) {
            throw new Error('Expected window blur listener to be registered.');
          }

          const blurEvent = new FocusEvent('blur');
          Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

          fireEvent.mouseLeave(viewport);
          await settle();

          blurListener(blurEvent);
          await settle();

          await tick(20);
          finishAnimation();
          await settle();
          await settle();

          expect(screen.queryAllByTestId('root')).toHaveLength(1);
          expect(viewport).not.toHaveAttribute('data-expanded');
        } finally {
          addEventListenerSpy.mockRestore();
          (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
        }
      },
    );

    it.skipIf(!isJSDOM)(
      'keeps timers paused on viewport blur while the window is blurred',
      async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        render(() => (
          <Toast.Provider>
            <Toast.Viewport data-testid="viewport">
              <List />
            </Toast.Viewport>
            <Button />
          </Toast.Provider>
        ));
        await settle();

        const button = screen.getByRole('button', { name: 'add' });
        await click(button);

        const blurListener = addEventListenerSpy.mock.calls.find(
          (call) => call[0] === 'blur' && call[2] === true,
        )?.[1] as EventListener | undefined;
        addEventListenerSpy.mockRestore();

        if (!blurListener) {
          throw new Error('Expected window blur listener to be registered.');
        }

        fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });
        await settle();
        expect(screen.getByTestId('viewport')).toHaveFocus();

        await tick(1000);

        const blurEvent = new FocusEvent('blur');
        Object.defineProperty(blurEvent, 'composedPath', { value: () => [window] });

        blurListener(blurEvent);
        await settle();

        button.focus();
        await settle();

        await tick(10000);

        expect(screen.queryByTestId('root')).not.toBe(null);
      },
    );
  });

  describe('focus management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.skipIf(!isJSDOM)('skips toasts animating out when tabbing into the viewport', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      await click(button); // oldest toast
      await click(button); // newest toast (toasts[0])

      const roots = screen.getAllByTestId('root');
      const newest = roots[0];
      const survivor = roots[1];

      // Close the newest toast. It enters the `ending` state and stays mounted
      // because the exit animation hasn't completed (no clock tick). The close
      // button is `aria-hidden` until expanded, so query it by attribute.
      (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = false;
      const newestCloseButton = document.querySelectorAll(
        '[aria-label="close-press"]',
      )[0] as HTMLElement;
      fireEvent.click(newestCloseButton);
      flush();

      // F6 focuses the viewport and renders the focus guards.
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'F6' });
      flush();

      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-base-ui-focus-guard]') as HTMLElement;
      fireEvent.focus(guard, { relatedTarget: viewport });
      flush();

      expect(survivor).toHaveFocus();
      expect(newest).not.toHaveFocus();
    });

    it.skipIf(!isJSDOM)('returns focus when no toast can receive focus', async () => {
      render(() => (
        <Toast.Provider limit={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await click(button);

      fireEvent.keyDown(button, { key: 'F6' });
      await settle();

      const viewport = screen.getByTestId('viewport');
      expect(viewport).toHaveFocus();

      const guard = document.querySelector('[data-base-ui-focus-guard]') as HTMLElement;
      fireEvent.focus(guard, { relatedTarget: viewport });
      await settle();

      expect(button).toHaveFocus();
    });

    it.skipIf(!isJSDOM)('returns focus to the trigger when every toast is closed', async () => {
      const manager = Toast.createToastManager();

      render(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await click(button);

      fireEvent.keyDown(button, { key: 'F6' });
      await settle();
      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-base-ui-focus-guard]') as HTMLElement;
      fireEvent.focus(guard, { relatedTarget: viewport });
      await settle();

      expect(screen.getByTestId('root')).toHaveFocus();

      // Closing everything leaves no toast to hand focus to.
      manager.close();
      await settle();

      expect(button).toHaveFocus();
    });

    it.skipIf(!isJSDOM)('moves focus past toasts animating out when one is closed', async () => {
      const manager = Toast.createToastManager();

      render(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();

      manager.add({ title: 'oldest' });
      await settle();
      manager.add({ id: 'middle', title: 'middle' });
      await settle();
      manager.add({ id: 'newest', title: 'newest' });
      await settle();

      const [newest, middle, oldest] = screen.getAllByTestId('root');
      expect(middle).toHaveTextContent('middle');

      fireEvent.keyDown(button, { key: 'F6' });
      await settle();
      const viewport = screen.getByTestId('viewport');
      const guard = document.querySelector('[data-base-ui-focus-guard]') as HTMLElement;
      fireEvent.focus(guard, { relatedTarget: viewport });
      await settle();

      expect(newest).toHaveFocus();

      // Dismissing both in one go leaves the middle toast animating out while
      // the focused toast closes, so focus has to skip over it.
      (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = false;
      manager.close('middle');
      manager.close('newest');
      flush();

      expect(middle).toHaveAttribute('data-ending-style');
      expect(oldest).toHaveFocus();
    });

    it.skipIf(!isJSDOM)('leaves focus alone when it is outside the viewport', async () => {
      const manager = Toast.createToastManager();

      render(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport data-testid="viewport">
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));
      await settle();

      const button = screen.getByRole('button', { name: 'add' });
      button.focus();
      await click(button);
      await click(button);

      // Focus never entered the viewport, so closing a toast must not steal it.
      manager.close();
      await settle();

      expect(button).toHaveFocus();
    });
  });
});
