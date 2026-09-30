import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { CheckboxGroup } from './index';
import { Checkbox } from '../checkbox';

describe('useCheckboxGroupParent', () => {
  const allValues = ['a', 'b', 'c'];

  it('should control child checkboxes', () => {
    const parentCheckedChange = vi.fn();
    const childCheckedChange = vi.fn();
    const [value, setValue] = createSignal<string[]>([]);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" onCheckedChange={parentCheckedChange} />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" onCheckedChange={childCheckedChange} />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const parent = screen.getByTestId('parent');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    fireEvent.click(parent);
    flush();
    expect(parent).toHaveAttribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(1);
    expect(childCheckedChange.mock.calls.length).toBe(0);

    fireEvent.click(parent);
    flush();
    expect(parent).toHaveAttribute('aria-checked', 'false');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(2);
    expect(childCheckedChange.mock.calls.length).toBe(0);
  });

  it('parent should be marked as mixed if some children are checked', () => {
    const childCheckedChange = vi.fn();
    const [value, setValue] = createSignal<string[]>([]);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" onCheckedChange={childCheckedChange} />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
    fireEvent.click(checkboxes[0]);
    flush();
    expect(childCheckedChange.mock.calls.length).toBe(1);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('updates uncontrolled parent-enabled groups from child clicks without duplicate callbacks', () => {
    const handleValueChange = vi.fn();

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const checkboxC = screen.getByTestId('checkboxC');

    fireEvent.click(checkboxA);
    flush();

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(parent);
    flush();

    expect(handleValueChange.mock.calls.length).toBe(2);
    expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b', 'c']);
    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');
    expect(checkboxC).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(parent);
    flush();

    expect(handleValueChange.mock.calls.length).toBe(3);
    expect(handleValueChange.mock.calls[2][0]).toEqual([]);
    expect(parent).toHaveAttribute('aria-checked', 'false');
    expect(checkboxA).toHaveAttribute('aria-checked', 'false');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
    expect(checkboxC).toHaveAttribute('aria-checked', 'false');
  });

  it('should correctly initialize the values array', () => {
    const [value, setValue] = createSignal<string[]>(['a']);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'true');
  });

  it('should update the values array when a child checkbox is clicked', () => {
    const [value, setValue] = createSignal<string[]>(['a']);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    const checkboxA = screen.getByTestId('checkboxA');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      if (checkbox !== checkboxA) {
        fireEvent.click(checkbox);
        flush();
      }
    });

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'true');
  });

  it('should apply space-separated aria-controls attribute with child names', async () => {
    const [value, setValue] = createSignal<string[]>([]);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
        <Checkbox.Root value="b" data-testid="b" />
        <Checkbox.Root value="c" data-testid="c" />
      </CheckboxGroup>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        allValues.map((v) => screen.getByTestId(v).id).join(' '),
      );
    });
  });

  it('keeps a custom child id in aria-controls', async () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root
          parent
          data-testid="parent"
          nativeButton
          render={(props) => <button {...props} />}
        />
        <Checkbox.Root
          id="custom"
          value="a"
          data-testid="a"
          nativeButton
          render={(props) => <button {...props} />}
        />
      </CheckboxGroup>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('a')).toHaveAttribute('id', 'custom');
    });
    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'custom');
    });
  });

  [false, true].forEach((nativeButton) => {
    it(`keeps a rendered child id in aria-controls (nativeButton=${nativeButton})`, async () => {
      render(() => (
        <CheckboxGroup allValues={['a']}>
          <Checkbox.Root
            parent
            data-testid="parent"
            nativeButton={nativeButton}
            render={nativeButton ? (props) => <button {...props} /> : undefined}
          />
          <Checkbox.Root
            value="a"
            nativeButton={nativeButton}
            render={
              nativeButton
                ? (props) => <button {...props} id="rendered" />
                : (props) => <span {...props} id="rendered" />
            }
          />
        </CheckboxGroup>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'rendered');
      });
    });
  });

  it('references the exposed child rather than its custom-id input without nativeButton', async () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="custom" value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    // The custom `id` lands on the hidden input, so `aria-controls` has to name the exposed
    // element instead.
    await waitFor(() => {
      expect(document.querySelector('input[type="checkbox"][id="custom"]')).not.toBe(null);
    });
    expect(screen.getByTestId('a').id).not.toBe('custom');
    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        screen.getByTestId('a').id,
      );
    });
  });

  it('does not read aria-controls ids off Object.prototype', async () => {
    render(() => (
      <CheckboxGroup allValues={['a', 'constructor']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        screen.getByTestId('a').id,
      );
    });
  });

  it('drops an unmounted child from aria-controls', async () => {
    const [showB, setShowB] = createSignal(true);

    render(() => (
      <CheckboxGroup allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
        <Show when={showB()}>
          <Checkbox.Root value="b" data-testid="b" />
        </Show>
      </CheckboxGroup>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        `${screen.getByTestId('a').id} ${screen.getByTestId('b').id}`,
      );
    });

    setShowB(false);
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        screen.getByTestId('a').id,
      );
    });
  });

  it('keeps both ids for checkboxes sharing a value and retains the survivor', async () => {
    const [showSecondB, setShowSecondB] = createSignal(true);

    render(() => (
      <CheckboxGroup allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
        <Checkbox.Root value="b" data-testid="b" />
        <Show when={showSecondB()}>
          <Checkbox.Root value="b" data-testid="second-b" />
        </Show>
      </CheckboxGroup>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        `${screen.getByTestId('a').id} ${screen.getByTestId('b').id} ${
          screen.getByTestId('second-b').id
        }`,
      );
    });

    setShowSecondB(false);
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('parent')).toHaveAttribute(
        'aria-controls',
        `${screen.getByTestId('a').id} ${screen.getByTestId('b').id}`,
      );
    });
  });

  it('does not select a child without an identifying value', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="standalone" data-testid="no-value" />
        <Checkbox.Root value="a" data-testid="checkbox-a" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const noValue = screen.getByTestId('no-value');
    const checkboxA = screen.getByTestId('checkbox-a');

    fireEvent.click(parent);
    flush();

    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(noValue).toHaveAttribute('aria-checked', 'false');
    expect(noValue.nextElementSibling).toHaveAttribute('id', 'standalone');
  });

  it('preserves initial state if mixed when parent is clicked', () => {
    const [value, setValue] = createSignal<string[]>([]);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const checkboxA = screen.getByTestId('checkboxA');
    const parent = screen.getByTestId('parent');

    fireEvent.click(checkboxA);
    flush();

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    fireEvent.click(parent);
    flush();

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    fireEvent.click(parent);
    flush();

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    fireEvent.click(parent);
    flush();

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    checkboxes.forEach((checkbox) => {
      if (checkbox !== checkboxA) {
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      }
    });
  });

  it('lets a parent checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = vi.fn();
    const handleParentChange = vi.fn(
      (_checked: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      },
    );

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" onCheckedChange={handleParentChange} />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    fireEvent.click(screen.getByTestId('parent'));
    flush();

    expect(handleParentChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxB')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxC')).toHaveAttribute('aria-checked', 'false');
  });

  it('lets a child checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = vi.fn();
    const handleChildChange = vi.fn(
      (_checked: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      },
    );

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" onCheckedChange={handleChildChange} />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    fireEvent.click(screen.getByTestId('checkboxA'));
    flush();

    expect(handleChildChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not advance the parent toggle cycle when the group cancels a parent change', () => {
    const handleValueChange = vi.fn(
      (_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      },
    );

    render(() => (
      <CheckboxGroup value={['a']} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');

    // From a mixed state the parent attempts to check all. The group cancels, so
    // the internal status must not advance to 'on'.
    fireEvent.click(parent);
    flush();
    // A second click must retry the same 'mixed -> on' transition instead of
    // skipping ahead to 'on -> off' and proposing an empty value.
    fireEvent.click(parent);
    flush();

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(allValues);
    expect(handleValueChange.mock.calls[1][0]).toEqual(allValues);
  });

  it('does not pollute the parent snapshot when the group cancels a child change', () => {
    const handleValueChange = vi.fn(
      (_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      },
    );

    render(() => (
      <CheckboxGroup value={allValues} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    // Unchecking a child is canceled, so the parent's snapshot of checked
    // children must stay intact.
    fireEvent.click(screen.getByTestId('checkboxA'));
    flush();
    // The parent still sees an all-checked group and toggles to none. A polluted
    // snapshot would make it propose checking everything again.
    fireEvent.click(screen.getByTestId('parent'));
    flush();

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['b', 'c']);
    expect(handleValueChange.mock.calls[1][0]).toEqual([]);
  });

  it('handles unchecked disabled checkboxes', () => {
    const [value, setValue] = createSignal<string[]>([]);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" disabled data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));
    flush();

    const parent = screen.getByTestId('parent');
    fireEvent.click(parent);
    flush();

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('handles checked disabled checkboxes', () => {
    const [value, setValue] = createSignal<string[]>(['a']);

    render(() => (
      <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" disabled />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));
    flush();

    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const parent = screen.getByTestId('parent');

    fireEvent.click(parent);
    flush();
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(parent);
    flush();
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
  });
});
