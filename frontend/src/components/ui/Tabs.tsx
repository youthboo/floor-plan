import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex flex-wrap items-center gap-2", className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const tabsTriggerVariants = cva(
  "cursor-pointer whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Top-level app nav: rounded pill group on a tinted header bar
        nav: "rounded-full px-5 py-2 text-sm text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm",
        // Bordered box group, e.g. list status filters
        segment:
          "rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 data-[state=active]:border-primary-300 data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700",
        // Solid rounded pill group, e.g. content/sheet switchers
        pill: "rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 data-[state=active]:border-transparent data-[state=active]:bg-primary-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "pill",
    },
  }
)

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("focus-visible:outline-none", className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
