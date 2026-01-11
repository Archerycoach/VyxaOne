import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number | string
  onValueChange?: (value: number) => void
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")

    // Format number to currency string (e.g., "1.234,56")
    const formatCurrency = (val: number | string | null | undefined): string => {
      if (val === null || val === undefined || val === "") return ""
      
      // Convert to number
      let num: number
      if (typeof val === "string") {
        // Remove all dots and replace comma with dot for parsing
        const cleanStr = val.replace(/\./g, "").replace(",", ".")
        num = parseFloat(cleanStr)
      } else {
        num = val
      }
      
      if (isNaN(num)) return ""
      
      return new Intl.NumberFormat("pt-PT", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num)
    }

    // Update display value when prop value changes
    React.useEffect(() => {
      const formatted = formatCurrency(value)
      setDisplayValue(formatted)
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      // Allow only numbers, commas and dots
      const cleanValue = inputValue.replace(/[^0-9,.]/g, "")
      
      // Update display immediately
      setDisplayValue(cleanValue)

      // Parse for the actual number value
      const numberString = cleanValue.replace(/\./g, "").replace(",", ".")
      const numberValue = parseFloat(numberString)

      if (!isNaN(numberValue) && onValueChange) {
        onValueChange(numberValue)
      } else if (cleanValue === "" && onValueChange) {
        onValueChange(0)
      }
    }

    const handleBlur = () => {
      // On blur, format nicely
      if (value !== null && value !== undefined && value !== "") {
        const formatted = formatCurrency(value)
        setDisplayValue(formatted)
      } else {
        setDisplayValue("")
      }
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-muted-foreground">€</span>
        <Input
          {...props}
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn("pl-7", className)}
          placeholder="0,00"
        />
      </div>
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }