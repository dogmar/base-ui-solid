import { describe, expect, it } from 'vitest';
import { hasRenderableChildren, isRenderableNode } from './isRenderableNode';

function createElementWithText(text?: string | number) {
  const element = document.createElement('div');
  if (text !== undefined) {
    element.append(document.createTextNode(String(text)));
  }
  return element;
}

describe('isRenderableNode', () => {
  it('treats renderable primitives as content', () => {
    expect(isRenderableNode(0)).toBe(true);
    expect(isRenderableNode(0n)).toBe(true);
    expect(isRenderableNode(Number.NaN)).toBe(true);
    expect(isRenderableNode('text')).toBe(true);
  });

  it('treats non-rendering values as empty', () => {
    expect(isRenderableNode(null)).toBe(false);
    expect(isRenderableNode(undefined)).toBe(false);
    expect(isRenderableNode(true)).toBe(false);
    expect(isRenderableNode(false)).toBe(false);
    expect(isRenderableNode('')).toBe(false);
  });

  it('recurses into arrays', () => {
    expect(isRenderableNode([])).toBe(false);
    expect(isRenderableNode([null, undefined, false])).toBe(false);
    expect(isRenderableNode([null, 0])).toBe(true);
    expect(isRenderableNode([[null]])).toBe(false);
    expect(isRenderableNode([[0]])).toBe(true);
  });
});

describe('hasRenderableChildren', () => {
  it('requires an element whose children are renderable', () => {
    expect(hasRenderableChildren(createElementWithText('text'))).toBe(true);
    expect(hasRenderableChildren(createElementWithText(0))).toBe(true);
    expect(hasRenderableChildren(createElementWithText())).toBe(false);
    expect(hasRenderableChildren(null)).toBe(false);
    expect(hasRenderableChildren('text')).toBe(false);
  });
});
