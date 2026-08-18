"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 5;

export function SkeletonTable({ columnCount }: { columnCount: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={i}>
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: SKELETON_ROWS }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columnCount }).map((_, c) => (
                <TableCell key={c}>
                  <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
