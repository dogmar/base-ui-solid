import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';

describe('<ScrollArea.Content />', () => {
  it('throws a descriptive error when rendered outside <ScrollArea.Viewport>', () => {
    expect(() =>
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Content />
        </ScrollArea.Root>
      )),
    ).toThrow(
      'Base UI: ScrollAreaViewportContext missing. ScrollAreaViewport parts must be placed within <ScrollArea.Viewport>.',
    );
  });

  it('supports a custom content renderer', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content data-testid="content" render={(props) => <div {...props} />} />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    flush();

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
