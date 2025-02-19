import { TextInput } from "@patternfly/react-core";
import { useFormContext } from "react-hook-form";

import { FieldProps, FormGroupField } from "./FormGroupField";

export const TextField = ({ label, field, isReadOnly = false }: FieldProps) => {
  const { register } = useFormContext();

  const style = isReadOnly
    ? { backgroundColor: "#444548", cursor: "not-allowed", color: "#AAB0AC" }
    : {};

  return (
    <FormGroupField label={label}>
      <TextInput
        id={label}
        data-testid={label}
        readOnly={isReadOnly}
        style={style} // Apply the custom styles
        {...register(field)}
      />
    </FormGroupField>
  );
};
