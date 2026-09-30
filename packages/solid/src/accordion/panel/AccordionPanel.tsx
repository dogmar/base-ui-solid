import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '@base-ui/utils/warn';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import type { AccordionRoot } from '../root/AccordionRoot';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import * as AccordionPanelCssVars from './AccordionPanelCssVars';
import { useRenderElement } from '../../internals/useRenderElement';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionPanel(componentProps: AccordionPanel.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'hiddenUntilFound',
    'keepMounted',
    'id',
    'render',
    'style',
    'ref',
  );


  const rootContext = useAccordionRootContext();
  const collapsibleContext = useCollapsibleRootContext();

  const hiddenUntilFound = () =>
    componentProps.hiddenUntilFound ?? rootContext.hiddenUntilFound();
  const keepMounted = () => componentProps.keepMounted ?? rootContext.keepMounted();
  const registeredId = () => componentProps.id || undefined;
  const id = () => (componentProps.id || undefined) ?? collapsibleContext.defaultPanelId();

  /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => ({
        hiddenUntilFound: hiddenUntilFound(),
        keepMounted: componentProps.keepMounted,
      }),
      (current) => {
        if (current.keepMounted === false && current.hiddenUntilFound) {
          warn(
            'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
          );
        }
      },
    );
  }

  createEffect(
    () => registeredId(),
    (currentRegisteredId) => {
      collapsibleContext.setPanelIdState((currentId) =>
        currentRegisteredId ?? (currentId === null ? undefined : currentId),
      );
      return () => {
        collapsibleContext.setPanelIdState((currentId) =>
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
      return collapsibleContext.mounted();
    },
    onOpenChange: collapsibleContext.onOpenChange,
    get open() {
      return collapsibleContext.open();
    },
    setMounted: collapsibleContext.setMounted,
    setOpen: collapsibleContext.setOpen,
    get transitionStatus() {
      return collapsibleContext.transitionStatus();
    },
  });

  const { state, triggerId } = useAccordionItemContext();

  const panelState: AccordionPanelState = {
    get value() {
      return state.value;
    },
    get disabled() {
      return state.disabled;
    },
    get orientation() {
      return state.orientation;
    },
    get hidden() {
      return state.hidden;
    },
    get index() {
      return state.index;
    },
    get open() {
      return state.open;
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
        get 'aria-labelledby'() {
          return triggerId();
        },
        role: 'region',
        get style() {
          const height = panel.height();
          const width = panel.width();
          return {
            [AccordionPanelCssVars.accordionPanelHeight]:
              height === undefined ? 'auto' : `${height}px`,
            [AccordionPanelCssVars.accordionPanelWidth]:
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
    stateAttributesMapping: accordionStateAttributesMapping,
  });
}

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    BaseUIComponentProps<'div', AccordionPanelState>,
    Pick<AccordionRoot.Props, 'hiddenUntilFound' | 'keepMounted'> {}

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
