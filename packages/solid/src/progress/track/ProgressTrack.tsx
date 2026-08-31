import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRenderElement } from '../../internals/useRenderElement';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
import type { ProgressRootState } from '../root/ProgressRoot';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * Contains the progress bar indicator.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressTrack(componentProps: ProgressTrack.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const context = useProgressRootContext();

  return useRenderElement('div', componentProps, {
    state: context.state,
    props: [elementProps],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressTrackState extends ProgressRootState {}

export interface ProgressTrackProps extends BaseUIComponentProps<'div', ProgressTrackState> {}

export namespace ProgressTrack {
  export type State = ProgressTrackState;
  export type Props = ProgressTrackProps;
}
