import { useEffect, useState } from "react";
import { Activity, ShieldCheck, UserCheck, UserX } from "lucide-react";

interface Props {
  resolvedCount: number;
  activeCount: number;
  enrolled: boolean;
}

export function Header({ resolvedCount, activeCount, enrolled }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">SARA</h1>
            <p className="font-mono-hud text-[10px] uppercase text-muted-foreground">
              Smart Adaptive Response Assistant
            </p>
          </div>
        </div>

        <div className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-foreground md:flex">
          <Activity className="h-3.5 w-3.5 text-success" />
          <span className="font-mono-hud text-[11px] uppercase">System active</span>
        </div>

        <div
          className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 md:flex ${
            enrolled
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          {enrolled ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
          <span className="font-mono-hud text-[11px] uppercase">
            {enrolled ? "Resident enrolled" : "No resident enrolled"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4 md:gap-6">
          <Stat label="ACTIVE" value={activeCount} tone={activeCount > 0 ? "alert" : "muted"} />
          <Stat label="RESOLVED" value={resolvedCount} tone="primary" />
          <div className="hidden text-right md:block">
            <div className="font-mono-hud text-base text-foreground">{time}</div>
            <div className="font-mono-hud text-[10px] uppercase text-muted-foreground">{date}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "alert" | "muted";
}) {
  const color =
    tone === "alert"
      ? "text-primary"
      : tone === "primary"
      ? "text-foreground"
      : "text-muted-foreground";
  return (
    <div className="text-right">
      <div className={`font-mono-hud text-xl leading-none ${color}`}>
        {value.toString().padStart(2, "0")}
      </div>
      <div className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
