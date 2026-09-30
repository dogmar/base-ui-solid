// Mirrors packages/react/src/utils/popups/index.ts. Only the modules needed by
// ported subsystems exist so far; later ports can extend it.
// Still missing compared to React: `inlineRect` (Preview Card),
// `useTriggerFocusGuards` (Popover/Menu).
export * from './popupHandle';
export * from './popupStoreUtils';
export * from './popupTriggerMap';
export * from './store';
export * from './usePopupHandleStore';
