import { render, screen } from '@solidjs/testing-library';
import { ListboxSeparator } from './ListboxSeparator';

describe('<ListboxSeparator />', () => {
  it('has role="presentation" and defaults to horizontal', () => {
    render(() => <ListboxSeparator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('role', 'presentation');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    expect(separator).not.toHaveAttribute('aria-orientation');
  });

  describe('prop: orientation', () => {
    (['horizontal', 'vertical'] as const).forEach((orientation) => {
      it(orientation, () => {
        render(() => <ListboxSeparator orientation={orientation} data-testid="separator" />);

        const separator = screen.getByTestId('separator');
        expect(separator).toHaveAttribute('data-orientation', orientation);
        expect(separator).not.toHaveAttribute('aria-orientation');
      });
    });
  });
});
