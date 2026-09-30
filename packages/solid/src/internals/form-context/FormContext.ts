import { createContext, useContext, type Accessor } from 'solid-js';
import type { FieldValidityData } from '../../field/root/FieldRoot';
import { NOOP } from '../noop';
import type { Form } from '../../form/Form';
import type { RefObject } from '../../solid-utils/refs';

export type Errors = Record<string, string | string[]>;

export interface FormContext {
  errors: Accessor<Errors>;
  clearErrors: (name: string | undefined) => void;
  elementRef: RefObject<HTMLFormElement>;
  formRef: {
    current: {
      fields: Map<
        string,
        {
          name: string | undefined;
          /**
           * After this returns, the field registry entry reflects the latest synchronous
           * validity verdict. Async validators do not block submit.
           */
          validate: () => void;
          validityData: FieldValidityData;
          controlRef: RefObject<HTMLElement>;
          getValue: () => unknown;
        }
      >;
    };
  };
  validationMode: Accessor<Form.ValidationMode>;
  submitCountRef: { current: number };
}

const DEFAULT_FORM_CONTEXT: FormContext = {
  elementRef: { current: null },
  formRef: {
    current: {
      fields: new Map(),
    },
  },
  errors: () => ({}),
  clearErrors: NOOP,
  validationMode: () => 'onSubmit',
  submitCountRef: {
    current: 0,
  },
};

export const FormContext = createContext<FormContext>(DEFAULT_FORM_CONTEXT);

export function useFormContext() {
  return useContext(FormContext);
}
