import { mergeProps, mergePropsN, mergeStyles, mergeSolidClasses } from './mergeProps';

describe('mergeProps', () => {
  it('merges plain props with rightmost precedence', () => {
    const merged = mergeProps({ id: 'a', title: 'x' }, { id: 'b' });
    expect(merged.id).toBe('b');
    expect(merged.title).toBe('x');
  });

  it('chains event handlers right-to-left', () => {
    const calls: string[] = [];
    const merged = mergeProps(
      { onClick: () => calls.push('internal') },
      { onClick: () => calls.push('external') },
    );
    (merged.onClick as (event: Event) => void)(new Event('click'));
    expect(calls).toEqual(['external', 'internal']);
  });

  it('preventBaseUIHandler stops earlier handlers', () => {
    const calls: string[] = [];
    const merged = mergeProps(
      { onClick: () => calls.push('internal') },
      {
        onClick: (event: any) => {
          calls.push('external');
          event.preventBaseUIHandler();
        },
      },
    );
    (merged.onClick as (event: Event) => void)(new Event('click'));
    expect(calls).toEqual(['external']);
  });

  it('non-DOM-event handlers always run', () => {
    const calls: string[] = [];
    const merged = mergeProps(
      { onValueChange: (value: number) => calls.push(`internal:${value}`) },
      { onValueChange: (value: number) => calls.push(`external:${value}`) },
    );
    (merged.onValueChange as (value: number) => void)(3);
    expect(calls).toEqual(['external:3', 'internal:3']);
  });

  it('merges class with their class first', () => {
    const merged = mergeProps({ class: 'ours' }, { class: 'theirs' });
    expect(merged.class).toEqual(['theirs', 'ours']);
  });

  it('normalizes className to class', () => {
    const merged = mergeProps({ className: 'a' } as any, { class: 'b' });
    expect(merged.class).toEqual(['b', 'a']);
    expect('className' in merged).toBe(false);
  });

  it('merges style objects with rightmost precedence', () => {
    const merged = mergeProps(
      { style: { color: 'red', width: '1px' } },
      { style: { color: 'blue' } },
    );
    expect(merged.style).toEqual({ color: 'blue', width: '1px' });
  });

  it('string style replaces object style', () => {
    const merged = mergeProps({ style: { color: 'red' } }, { style: 'color: blue' });
    expect(merged.style).toBe('color: blue');
  });

  it('supports props getter functions receiving merged-so-far props', () => {
    const merged = mergeProps({ id: 'a', title: 't' }, (prev) => ({
      id: `${prev.id}-suffixed`,
    }));
    expect(merged.id).toBe('a-suffixed');
    expect(merged.title).toBeUndefined();
  });

  it('mergePropsN merges arrays of props', () => {
    const merged = mergePropsN([{ id: 'a' }, { id: 'b', role: 'button' }, undefined]);
    expect(merged.id).toBe('b');
    expect(merged.role).toBe('button');
  });
});

describe('mergeStyles', () => {
  it('returns the other style when one is missing', () => {
    expect(mergeStyles(undefined, { color: 'red' })).toEqual({ color: 'red' });
    expect(mergeStyles({ color: 'red' }, undefined)).toEqual({ color: 'red' });
  });
});

describe('mergeSolidClasses', () => {
  it('keeps single class values unwrapped', () => {
    expect(mergeSolidClasses(undefined, 'a')).toBe('a');
    expect(mergeSolidClasses('a', undefined)).toBe('a');
  });
});
