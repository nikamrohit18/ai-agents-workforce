"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Phone, PhoneMissed, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Appointment = {
  id: string;
  caller_name: string;
  caller_phone: string;
  requested_at: string;
  duration_minutes: number;
  notes: string | null;
  status: string;
};

type Call = {
  id: string;
  caller_phone: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  transcript: string | null;
  booked_appointment_id: string | null;
  created_at: string;
};

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function appointmentStatusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof Phone;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function TableSkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <TableRow key={i}>
          <TableCell colSpan={5}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function VoiceAgent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsLoaded, setCallsLoaded] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  useEffect(() => {
    fetch("/api/voice/appointments")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAppointments)
      .finally(() => setAppointmentsLoaded(true));

    fetch("/api/voice/calls")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCalls)
      .finally(() => setCallsLoaded(true));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Voice Receptionist</h1>
            <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
              <Phone className="size-3" />
              Vapi + Twilio
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Answers inbound calls, books appointments, and texts back callers it misses.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Upcoming appointments</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {!appointmentsLoaded ? (
                <Table>
                  <TableBody>
                    <TableSkeletonRows />
                  </TableBody>
                </Table>
              ) : appointments.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  message="No appointments booked yet - they'll show up here as soon as a caller books one."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caller</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.caller_name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.caller_phone}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {dateTimeFormat.format(new Date(a.requested_at))}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground" title={a.notes ?? undefined}>
                          {a.notes ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={appointmentStatusVariant(a.status)} className="capitalize">
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Recent calls</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {!callsLoaded ? (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-2.5 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  message="No calls yet - once your Vapi number goes live, calls will land here with a status and transcript."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {calls.map((call) => (
                    <li key={call.id}>
                      <button
                        onClick={() => setSelectedCall(call)}
                        disabled={!call.transcript}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                            call.status === "missed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {call.status === "missed" ? (
                            <PhoneMissed className="size-3.5" />
                          ) : (
                            <Phone className="size-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{call.caller_phone}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateTimeFormat.format(new Date(call.created_at))}
                          </p>
                        </div>
                        <Badge variant={call.status === "missed" ? "destructive" : "secondary"} className="capitalize">
                          {call.status}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Call with {selectedCall?.caller_phone}</DialogTitle>
            <DialogDescription>
              {selectedCall && dateTimeFormat.format(new Date(selectedCall.created_at))}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
            {selectedCall?.transcript || "No transcript available for this call."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
