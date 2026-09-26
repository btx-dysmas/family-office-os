"use client";
import { Cake, CalendarDays } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel, Pill } from "@/components/kit";
import { ageOn, date, daysUntil, nextBirthday } from "@/lib/format";
import { actions, useBook } from "@/lib/store";

export default function Relationships() {
  const { households } = useBook();
  const people = households.flatMap((h) => h.people.map((p) => ({ ...p, h })));
  const birthdays = people.map((p) => ({ ...p, days: nextBirthday(p.dob) })).sort((a, b) => a.days - b.days).slice(0, 8);
  const tasks = households.flatMap((h) => h.tasks.filter((t) => !t.done).map((t) => ({ ...t, h }))).sort((a, b) => (a.due < b.due ? -1 : 1));
  const activity = households.flatMap((h) => h.notes.map((n) => ({ ...n, h }))).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);

  return (
    <>
      <PageHeader eyebrow="Family office CRM" title="Relationships" sub="Private banking is relationship management first. Last contact, upcoming meetings, birthdays and open commitments across every family." />
      <Panel title="Households" pad={false}>
        <div className="overflow-x-auto">
          <table className="grid-table">
            <thead><tr><th>Household</th><th>Clients</th><th>Last contact</th><th>Next meeting</th><th className="r">Open tasks</th><th>Preferences</th></tr></thead>
            <tbody>
              {households.map((h) => {
                const last = [...h.notes].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
                const since = last ? -daysUntil(last.date) : null;
                return (
                  <tr key={h.id}>
                    <td><Link href={`/households/${h.id}/relationship`} className="font-medium hover:text-gold">{h.name}</Link><div className="text-[11.5px] text-muted-foreground">{h.tier}</div></td>
                    <td className="text-muted-foreground">{h.people.filter((p) => p.relationship === "client" || p.relationship === "spouse").map((p) => p.name).join(", ")}</td>
                    <td>{last ? <>{date(last.date)} <span className={since! > 60 ? "text-warn" : "text-muted-foreground"}>({since} days)</span></> : "—"}</td>
                    <td>{h.nextMeeting ? <>{date(h.nextMeeting)} <span className="text-muted-foreground">in {daysUntil(h.nextMeeting)} days</span></> : <Pill kind="Watch">Not scheduled</Pill>}</td>
                    <td className="r">{h.tasks.filter((t) => !t.done).length}</td>
                    <td className="max-w-[360px] truncate text-[12px] text-muted-foreground">{h.preferences.slice(0, 2).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Open commitments" sub={`${tasks.length} tasks across the book`}>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.h.id + t.id} className="flex items-start gap-2.5">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--gold)]" onChange={() => actions.update(t.h.id, (x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, done: true } : y)) }))} aria-label={t.title} />
                <div className="text-[13px]">{t.title}<div className="text-[11.5px] text-muted-foreground">{t.h.name} · due {date(t.due)}{daysUntil(t.due) < 0 ? " · overdue" : ""}</div></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Upcoming birthdays">
          <ul className="space-y-2.5">
            {birthdays.map((p) => (
              <li key={p.h.id + p.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2.5"><Cake className="size-4 text-gold" /><span>{p.name}<div className="text-[11.5px] text-muted-foreground">{p.h.name} · turns {ageOn(p.dob) + 1}</div></span></span>
                <span className="text-[12px] text-muted-foreground">{p.days === 0 ? "Today" : `${p.days} days`}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent activity">
          <ul className="space-y-3">
            {activity.map((n) => (
              <li key={n.h.id + n.id} className="text-[13px]">
                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground"><CalendarDays className="size-3" />{date(n.date)} · {n.category} · {n.h.name}</div>
                <p className="line-clamp-2">{n.summary}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
