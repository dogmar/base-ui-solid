import { describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Tooltip.Portal />', () => {
  describe('prop: keepMounted', () => {
    function ClosedTooltip(props: { keepMounted?: boolean }) {
      return (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal keepMounted={props.keepMounted}>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    it('renders the closed popup as hidden instead of unmounting it', async () => {
      render(() => <ClosedTooltip keepMounted />);
      await settle();

      expect(screen.getByTestId('popup')).not.toBeVisible();
    });

    it('unmounts the closed popup by default', async () => {
      render(() => <ClosedTooltip />);
      await settle();

      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });
});
