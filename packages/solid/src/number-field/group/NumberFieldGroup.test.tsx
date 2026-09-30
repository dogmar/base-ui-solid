import { expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { NumberField } from '../index';

describe('<NumberField.Group />', () => {
  it('has role prop', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Group />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('group')).not.toBe(null);
  });
});
