import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  return (
    <label className="grid gap-1 text-sm text-muted-foreground">
      {label}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="button"
          className={cn(buttonVariants({ variant: "outline" }), "h-9 w-40 justify-start font-normal text-foreground")}
        >
          <CalendarIcon />
          {selected
            ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "Choose a date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (!day) return;
              onChange(formatDay(day));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

function parseDay(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
