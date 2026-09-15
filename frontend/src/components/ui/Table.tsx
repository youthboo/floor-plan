import * as React from "react"
import { cn } from "../../lib/utils"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Overrides the wrapper div's classes (e.g. to drop the border/bg when the
   * table already sits inside a styled Card, or to cap height for a sticky header). */
  containerClassName?: string
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("w-full overflow-auto border border-gray-200 rounded-lg bg-white", containerClassName)}>
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("border-b border-gray-200 bg-gray-50", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-gray-200 bg-gray-50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-gray-100 transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** "default" = uppercase small-caps label. "plain" = normal-case text-sm label,
   * matching read-only detail-page tables. */
  variant?: "default" | "plain"
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        variant === "default"
          ? "h-12 px-6 py-3 text-left align-middle font-bold text-gray-700 uppercase text-xs tracking-wider [&:has([role=checkbox])]:pr-0"
          : "px-4 py-3 text-left align-middle font-medium text-slate-700 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-6 py-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell }
