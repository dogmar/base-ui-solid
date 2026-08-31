import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '@base-ui/utils/warn';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import { useCollapsiblePanel } from './useCollapsiblePanel';
import * as CollapsiblePanelCssVars from './CollapsiblePanelCssVars';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsiblePanel(componentProps: CollapsiblePanel.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'hiddenUntilFound',
    'keepMounted',
    'render',
    'id',
    'style',
    'ref',
  );


  /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => ({
        hiddenUntilFound: componentProps.hiddenUntilFound,
        keepMounted: componentProps.keepMounted,
      }),
      (current) => {
        if (current.hiddenUntilFound && current.keepMounted === false) {
          warn(
            'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
          );
        }
      },
    );
  }

  const context = useCollapsibleRootContext();

  const hiddenUntilFound = () => componentProps.hiddenUntilFound ?? false;
  const keepMounted = () => componentProps.keepMounted ?? false;
  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? context.defaultPanelId();

  createEffect(
    () => registeredId(),
    (currentRegisteredId) => {
      context.setPanelIdState((currentId) =>
        currentRegisteredId ?? (currentId === null ? undefined : currentId),
      );
      return () => {
        context.setPanelIdState((currentId) =>
          currentId === currentRegisteredId ? null : currentId,
        );
      };
    },
  );

  const panel = useCollapsiblePanel({
    get externalRef() {
      return componentProps.ref;
    },
    get hiddenUntilFound() {
      return hiddenUntilFound();
    },
    get id() {
      return id();
    },
    get keepMounted() {
      return keepMounted();
    },
    get mounted() {
      return context.mounted();
    },
    onOpenChange: context.onOpenChange,
    get open() {
      return context.open();
    },
    setMounted: context.setMounted,
    setOpen: context.setOpen,
    get transitionStatus() {
      return context.transitionStatus();
    },
  });

  const panelState: CollapsiblePanelState = {
    get open() {
      return context.state.open;
    },
    get disabled() {
      return context.state.disabled;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };

  const resolvedStyle = () => resolveStyle(componentProps.style, panelState);

  // The public `style` prop is resolved manually (against the panel state) and
  // merged below so temporary `animation-name: 'none'` can still win after the
  // user's inline styles have been merged.
  const componentPropsWithoutStyle = {
    get className() {
      return componentProps.className;
    },
    get class() {
      return componentProps.class;
    },
    get render() {
      return componentProps.render;
    },
    style: undefined,
  };

  return useRenderElement('div', componentPropsWithoutStyle, {
    state: panelState,
    enabled: panel.shouldRender,
    ref: panel.ref,
    props: [
      panel.props,
      {
        get style() {
          const height = panel.height();
          const width = panel.width();
          return {
            [CollapsiblePanelCssVars.collapsiblePanelHeight]:
              height === undefined ? 'auto' : `${height}px`,
            [CollapsiblePanelCssVars.collapsiblePanelWidth]:
              width === undefined ? 'auto' : `${width}px`,
          } as JSX.CSSProperties;
        },
      },
      elementProps,
      {
        get style() {
          return resolvedStyle();
        },
      },
      {
        get style() {
          return panel.shouldPreventOpenAnimation()
            ? ({ 'animation-name': 'none' } as JSX.CSSProperties)
            : undefined;
        },
      },
    ],
    stateAttributesMapping: collapsibleStateAttributesMapping,
  });
}

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps extends BaseUIComponentProps<'div', CollapsiblePanelState> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
