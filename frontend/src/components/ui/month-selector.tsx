import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

interface MonthValue {
  year: number
  month: number // 1-12
}

interface MonthSelectorProps {
  value: MonthValue
  onChange: (value: MonthValue) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  function prev() {
    if (value.month === 1) {
      onChange({ year: value.year - 1, month: 12 })
    } else {
      onChange({ year: value.year, month: value.month - 1 })
    }
  }

  function next() {
    if (value.month === 12) {
      onChange({ year: value.year + 1, month: 1 })
    } else {
      onChange({ year: value.year, month: value.month + 1 })
    }
  }

  const date = new Date(value.year, value.month - 1, 1)
  const label = format(date, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="w-36 text-center text-sm font-medium capitalize">{label}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
