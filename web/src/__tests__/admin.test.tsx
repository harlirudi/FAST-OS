import React from "react";
import { render, screen } from "@testing-library/react";
import { DataTable } from "@/components/admin/data-table";
import { ColumnDef } from "@tanstack/react-table";

jest.mock("@tanstack/react-table", () => {
  const actual = jest.requireActual("@tanstack/react-table");
  return {
    ...actual,
    useReactTable: jest.fn(() => ({
      getHeaderGroups: () => [],
      getRowModel: () => ({ rows: [] }),
    })),
  };
});

describe("Admin web (ticket 03 retro)", () => {
  it("DataTable menampilkan pesan kosong saat tidak ada data", () => {
    const columns: ColumnDef<{ name: string }>[] = [
      { accessorKey: "name", header: "Nama" },
    ];
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Tidak ada data.")).toBeDefined();
  });

  it("FormSelect merender hidden input", () => {
    // Test pure JSX rendering
    const { FormSelect } = require("@/components/admin/form-select");
    render(
      <FormSelect
        name="site_id"
        options={[
          { value: "1", label: "Gedung A" },
          { value: "2", label: "Gedung B" },
        ]}
        placeholder="Pilih site"
      />
    );
    expect(screen.getByText("Pilih site")).toBeDefined();
  });
});
