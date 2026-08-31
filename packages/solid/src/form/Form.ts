// TODO(form): the `<Form>` component itself is not yet ported. This module
// carries only the public `Form` types that the field subsystem depends on,
// mirroring `packages/react/src/form/Form.tsx`. When the component is ported,
// these types move into the full implementation unchanged.

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

export namespace Form {
  export type ValidationMode = FormValidationMode;
  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}
