import { expect, test } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { FloatingPortal, useFloating } from '../index';
import { FloatingPortalLite } from '../../utils/FloatingPortalLite';
import type { UseFloatingPortalNodeProps } from './FloatingPortal';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function App(props: { container?: UseFloatingPortalNodeProps['container'] }) {
  const [open, setOpen] = createSignal(false);
  const { refs } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: (nextOpen) => setOpen(nextOpen),
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <FloatingPortal container={props.container}>
        <Show when={open()}>
          <div ref={refs.setFloating} data-testid="floating" />
        </Show>
      </FloatingPortal>
    </>
  );
}

describe('FloatingPortal', () => {
  test('defaults to document.body', async () => {
    render(() => <App />);
    screen.getByTestId('reference').click();
    await settle();

    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-base-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(document.body);
  });

  test('allows custom containers', async () => {
    const customRoot = document.createElement('div');
    customRoot.id = 'custom-root';
    document.body.appendChild(customRoot);
    render(() => <App container={customRoot} />);
    screen.getByTestId('reference').click();
    await settle();

    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-base-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(customRoot);
    customRoot.remove();
  });

  test('allows refs as containers', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };
    render(() => <App container={ref} />);
    screen.getByTestId('reference').click();
    await settle();

    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-base-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(el);
    document.body.removeChild(el);
  });

  test('allows containers to be initially null', async () => {
    function RootApp() {
      const [container, setContainer] = createSignal<HTMLElement | null>(null);

      return (
        <>
          <div ref={setContainer} data-testid="root" />
          <App container={container()} />
        </>
      );
    }

    render(() => <RootApp />);
    screen.getByTestId('reference').click();
    await settle();

    const subRoot = screen.getByTestId('floating').parentElement;
    const root = screen.getByTestId('root');
    expect(root).toBe(subRoot?.parentElement);
  });

  test('reattaches the portal when the container changes', async () => {
    const customRoot = document.createElement('div');
    document.body.appendChild(customRoot);

    try {
      const [container, setContainer] = createSignal<UseFloatingPortalNodeProps['container']>(
        undefined,
      );

      render(() => <App container={container()} />);

      screen.getByTestId('reference').click();
      await settle();

      expect(screen.getByTestId('floating').parentElement?.parentElement).toBe(document.body);

      setContainer(customRoot);
      await settle();

      expect(screen.getByTestId('floating').parentElement?.parentElement).toBe(customRoot);

      setContainer(undefined);
      await settle();

      const floatingInBodyAgain = screen.getByTestId('floating');
      expect(floatingInBodyAgain.parentElement?.parentElement).toBe(document.body);
      expect(customRoot.contains(floatingInBodyAgain)).toBe(false);
    } finally {
      customRoot.remove();
    }
  });

  test('forwards HTML props to the portal element', async () => {
    render(() => (
      <FloatingPortal data-testid="portal-element" className="closed">
        <div />
      </FloatingPortal>
    ));

    await settle();

    const portal = document.querySelector('[data-testid="portal-element"]') as HTMLElement | null;
    expect(portal).not.toBeNull();
    expect(portal).toHaveClass('closed');
    expect(portal).toHaveAttribute('data-base-ui-portal');
  });

  test('supports a custom portal id', async () => {
    render(() => (
      <FloatingPortal id="custom-portal" data-testid="portal-element">
        <div />
      </FloatingPortal>
    ));

    await settle();

    const portal = document.querySelector('[data-testid="portal-element"]');
    expect(portal).toHaveAttribute('id', 'custom-portal');
  });

  test('FloatingPortalLite forwards HTML props to the portal element', async () => {
    render(() => (
      <FloatingPortalLite data-testid="lite-portal">
        <div data-testid="lite-child" />
      </FloatingPortalLite>
    ));

    await settle();

    const portal = document.querySelector('[data-testid="lite-portal"]');
    expect(portal).not.toBeNull();
    expect(screen.getByTestId('lite-child').parentElement).toBe(portal);
  });

  test('nested portals mount into the parent portal node', async () => {
    render(() => (
      <FloatingPortal data-testid="outer-portal">
        <div data-testid="outer-child" />
        <FloatingPortal data-testid="inner-portal">
          <div data-testid="inner-child" />
        </FloatingPortal>
      </FloatingPortal>
    ));

    await settle();
    // A second settle lets the nested portal resolve its parent container.
    await settle();

    const outer = document.querySelector('[data-testid="outer-portal"]');
    const inner = document.querySelector('[data-testid="inner-portal"]');
    expect(outer).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(inner?.parentElement).toBe(outer);
    expect(screen.getByTestId('inner-child').parentElement).toBe(inner);
  });
});
