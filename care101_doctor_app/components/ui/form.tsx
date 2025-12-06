"use client"

import * as React from "react"
import { View, Text, TextInput, StyleSheet } from "react-native"
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from '@/utils/cn';
import { Label } from "@/components/ui/label"

// Re-export FormProvider as Form
const Form = FormProvider

// -------------------------
// Form Field Context
// -------------------------
type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

// -------------------------
// Form Item Context
// -------------------------
type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<View, React.ComponentProps<typeof View>>(
  ({ style, children, ...props }, ref) => {
    const id = React.useId()

    return (
      <FormItemContext.Provider value={{ id }}>
        <View ref={ref} style={style} {...props}>
          {children}
        </View>
      </FormItemContext.Provider>
    )
  }
)
FormItem.displayName = "FormItem"

// -------------------------
// useFormField Hook
// -------------------------
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

// -------------------------
// Form Label
// -------------------------
const FormLabel = React.forwardRef<Text, React.ComponentProps<typeof Label>>(
  ({ style, ...props }, ref) => {
    const { error } = useFormField()

    return <Label ref={ref} style={style} {...props} />
  }
)
FormLabel.displayName = "FormLabel"

// -------------------------
// Form Control
// -------------------------
const FormControl = React.forwardRef<View, React.ComponentProps<typeof View>>(
  ({ style, children, ...props }, ref) => {
    const { error } = useFormField()
    return (
      <View ref={ref} style={style} {...props}>
        {children}
      </View>
    )
  }
)
FormControl.displayName = "FormControl"

// -------------------------
// Form Description
// -------------------------
const FormDescription = React.forwardRef<Text, React.ComponentProps<typeof Text>>(
  ({ style, children, ...props }, ref) => {
    return (
      <Text ref={ref} style={[styles.description, style]} {...props}>
        {children}
      </Text>
    )
  }
)
FormDescription.displayName = "FormDescription"

// -------------------------
// Form Message
// -------------------------
const FormMessage = React.forwardRef<Text, React.ComponentProps<typeof Text>>(
  ({ style, children, ...props }, ref) => {
    const { error } = useFormField()
    if (!error) return null
    return (
      <Text ref={ref} style={[styles.message, style]} {...props}>
        {String(error.message)}
      </Text>
    )
  }
)
FormMessage.displayName = "FormMessage"

// -------------------------
// Styles
// -------------------------
const styles = StyleSheet.create({
  description: {
    fontSize: 12,
    color: "#6B7280", // gray-500
  },
  message: {
    fontSize: 12,
    color: "#DC2626", // red-600
  },
})

// -------------------------
// Export all
// -------------------------
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
