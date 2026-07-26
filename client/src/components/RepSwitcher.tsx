import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRep, REP_OPTIONS, RepEmail } from "@/contexts/RepContext";
import { UserCircle } from "lucide-react";

export function RepSwitcher() {
  const { selectedRep, setSelectedRep, repInfo } = useRep();

  const currentOption = REP_OPTIONS.find(r => r.email === selectedRep) || REP_OPTIONS[0];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <UserCircle className="h-5 w-5 text-muted-foreground" />
      <Select
        value={currentOption.value}
        onValueChange={(value) => {
          const option = REP_OPTIONS.find(r => r.value === value);
          if (option) {
            setSelectedRep(option.email);
          }
        }}
      >
        <SelectTrigger className="w-[220px] bg-background/50 border-border/50">
          <SelectValue placeholder="Select view" />
        </SelectTrigger>
        <SelectContent>
          {REP_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
