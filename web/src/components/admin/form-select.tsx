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
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue || "");

  // Base UI Select butuh peta items: { value: ReactNode } agar tampil label
  const items = Object.fromEntries(options.map((opt) => [opt.value, opt.label]));

  return (
    <>
      <Select
        items={items}
        value={value || undefined}
        onValueChange={(v) => setValue(v ?? "")}
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
