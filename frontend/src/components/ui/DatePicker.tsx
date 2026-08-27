import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Button } from "./Button"
import { Calendar } from "./Calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./Popover"
import { cn } from "../../lib/utils"

export interface DatePickerProps {
  /** Date value as an ISO string (yyyy-MM-dd), matching native <input type="date"> */
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

function parseValue(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  id,
}) => {
  const [open, setOpen] = React.useState(false)
  const selected = parseValue(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start border-slate-200 px-3 text-left font-normal",
            selected ? "text-slate-900" : "text-slate-400",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">
            {selected ? format(selected, "dd/MM/yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePicker
