"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FormSelect({
  name,
  defaultValue,
  options,
  placeholder = "Pilih...",
  required,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue || "");

  // Base UI Select butuh peta items: { value: ReactNode } agar tampil label
  const items = Object.fromEntries(options.map((opt) => [opt.value, opt.label]));

  return (
    <>
      <Select
        items={items}
        value={value || undefined}
        onValueChange={(v) => {
          const next = v ?? "";
          setValue(next);
          onChange?.(next);
        }}
        required={required}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </>
  );
}
