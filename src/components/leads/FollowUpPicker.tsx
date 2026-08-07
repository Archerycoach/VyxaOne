import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarClock } from "lucide-react";
import { FOLLOW_UP_OPTIONS, type FollowUpChoice } from "@/lib/followUpSchedule";

interface FollowUpPickerProps {
  choice: FollowUpChoice;
  onChoiceChange: (choice: FollowUpChoice) => void;
  customDate: string;
  onCustomDateChange: (date: string) => void;
}

/**
 * Pergunta "daqui a quanto tempo deve ser feito o follow-up?" — pensado para
 * viver dentro de um formulário de registo de interação. Quem chama decide o
 * que fazer com a escolha (normalmente: agendar um evento "Follow-up" na
 * agenda ao gravar a interação, via resolveFollowUpDate).
 */
export function FollowUpPicker({ choice, onChoiceChange, customDate, onCustomDateChange }: FollowUpPickerProps) {
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-2">
      <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0">Follow-up:</span>
      <Select value={choice} onValueChange={(v) => onChoiceChange(v as FollowUpChoice)}>
        <SelectTrigger className="w-[160px] bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FOLLOW_UP_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choice === "custom" && (
        <Input
          type="date"
          value={customDate}
          min={todayIso}
          onChange={(e) => onCustomDateChange(e.target.value)}
          className="w-[160px] bg-white"
        />
      )}
    </div>
  );
}
