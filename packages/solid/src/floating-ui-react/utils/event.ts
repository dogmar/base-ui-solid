// Subset of the React `floating-ui-react/utils/event` module: only the
// functions needed by the ported composite subsystem. Later ports can extend
// this file.

export function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}
