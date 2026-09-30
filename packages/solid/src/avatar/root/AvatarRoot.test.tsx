import { render, screen } from '@solidjs/testing-library';
import { Avatar } from '..';

describe('<Avatar.Root />', () => {
  it('renders a span', () => {
    render(() => <Avatar.Root data-testid="root" />);
    expect(screen.getByTestId('root').tagName).toBe('SPAN');
  });

  it('forwards props and children', () => {
    render(() => (
      <Avatar.Root data-testid="root" id="my-avatar">
        <span data-testid="child" />
      </Avatar.Root>
    ));
    expect(screen.getByTestId('root')).toHaveAttribute('id', 'my-avatar');
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('supports className merging and the render prop', () => {
    render(() => (
      <Avatar.Root
        data-testid="root"
        className="a"
        class="b"
        render={(props) => <div {...props} />}
      />
    ));
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('DIV');
    expect(root.classList.contains('a')).toBe(true);
    expect(root.classList.contains('b')).toBe(true);
  });

  it('calls refs with the rendered element', () => {
    let called: HTMLElement | null = null;
    render(() => <Avatar.Root ref={(el: HTMLElement | null) => (called = el)} />);
    expect(called).not.toBeNull();
    expect((called as unknown as HTMLElement).tagName).toBe('SPAN');
  });
});
