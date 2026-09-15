"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

type ControlProps = {
  id?: string;
  type?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function FormField({
  children,
  className = "",
  error,
  errorClassName = "mt-1 block text-sm text-red-700",
  label,
}: {
  children: ReactNode;
  className?: string;
  error?: string;
  errorClassName?: string;
  label: string;
}) {
  const generatedId = useId();
  const controlId = `${generatedId}-control`;
  const errorId = `${generatedId}-error`;

  const controls = Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "string") return child;
    if (!["input", "select", "textarea"].includes(child.type)) return child;

    const element = child as ReactElement<ControlProps>;
    if (element.props.type === "hidden") return child;

    return cloneElement(element, {
      id: element.props.id ?? controlId,
      "aria-describedby": error ? errorId : element.props["aria-describedby"],
      "aria-invalid": error ? true : element.props["aria-invalid"],
    });
  });

  return (
    <label className={className} htmlFor={controlId}>
      {label}
      {controls}
      {error ? <span className={errorClassName} id={errorId}>{error}</span> : null}
    </label>
  );
}
