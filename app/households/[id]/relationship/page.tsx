"use client";
import { Cake, Mail, Phone, Plus, X } from "lucide-react";
import { useState } from "react";
import { KV, Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { ageOn, date, daysUntil, nextBirthday, today, uid } from "@/lib/format";
import { useHH } from "@/lib/household-context";
import type { NoteCategory } from "@/lib/types";

const CATEGORIES: NoteCategory[] = ["Meeting", "Call", "Email", "Recommendation", "Follow-up", "Review"];
const CAT_KIND: Record<NoteCategory, "gold" | "Moderate" | "neutral" | "Low" | "Watch"> = { Meeting: "gold", Review: "gold", Call: "Moderate", Email: "neutral", Recommendation: "Low", "Follow-up": "Watch" };

export default function Relationship() {
  const { h, update } = useHH();
  const [note, setNote] = useState({ date: today(), category: "Meeting" as NoteCategory, summary: "" });
  const [task, setTask] = useState({ title: "", due: today() });
  const [pref, setPref] = useState("");
  const [filter, setFilter] = useState<NoteCategory | "All">("All");
  const notes = [...h.notes].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = notes[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Activity log" sub={`${h.notes.length} entries · last contact ${last ? `${date(last.date)} (${-daysUntil(last.date)} days ago)` : "never"}`}
          action={<select className="field h-7 w-auto" value={filter} onChange={(e) => setFilter(e.target.value as NoteCategory | "All")}><option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}>
          <form className="mb-4 rounded-lg border border-border bg-subtle p-3" onSubmit={(e) => {
            e.preventDefault();
            if (!note.summary.trim()) return;
            update((x) => ({ ...x, notes: [...x.notes, { id: uid(), ...note, summary: note.summary.trim(), author: x.advisor }] }));
            setNote({ ...note, summary: "" });
          }}>
            <div className="grid gap-2 sm:grid-cols-[140px_160px_1fr]">
              <input type="date" className="field" value={note.date} onChange={(e) => setNote({ ...note, date: e.target.value })} aria-label="Date" />
              <select className="field" value={note.category} onChange={(e) => setNote({ ...note, category: e.target.value as NoteCategory })} aria-label="Category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <div className="flex gap-2">
                <input className="field" placeholder="Summary of the conversation, recommendation or follow-up" value={note.summary} onChange={(e) => setNote({ ...note, summary: e.target.value })} aria-label="Summary" />
                <Button type="submit" size="sm"><Plus /> Log</Button>
              </div>
            </div>
          </form>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {notes.filter((n) => filter === "All" || n.category === filter).map((n) => (
              <li key={n.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-gold" />
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><span>{date(n.date)}</span><Pill kind={CAT_KIND[n.category]}>{n.category}</Pill><span>{n.author}</span>
                  <button className="ml-auto opacity-40 hover:opacity-100" aria-label="Delete note" onClick={() => update((x) => ({ ...x, notes: x.notes.filter((y) => y.id !== n.id) }))}><X className="size-3.5" /></button>
                </div>
                <p className="mt-1 text-[13.5px]">{n.summary}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Relationship">
          <KV rows={[
            ["Client since", date(h.since)],
            ["Last contact", last ? date(last.date) : "—"],
            ["Next meeting", <input key="m" type="date" className="field h-7 w-40" value={h.nextMeeting ?? ""} onChange={(e) => update((x) => ({ ...x, nextMeeting: e.target.value }))} />],
            ["Primary advisor", h.advisor],
            ["Service tier", h.tier],
          ]} />
        </Panel>

        <Panel title="Open tasks" sub={`${h.tasks.filter((t) => !t.done).length} open`}>
          <ul className="space-y-1.5">
            {h.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2.5">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--gold)]" checked={t.done} onChange={() => update((x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, done: !y.done } : y)) }))} aria-label={t.title} />
                <div className={`min-w-0 flex-1 text-[13px] ${t.done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                  <div className="text-[11.5px] text-muted-foreground">Due {date(t.due)}{!t.done && daysUntil(t.due) < 0 ? " · overdue" : ""}{t.priority === "High" ? " · high priority" : ""}</div>
                </div>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!task.title.trim()) return;
            update((x) => ({ ...x, tasks: [...x.tasks, { id: uid(), title: task.title.trim(), due: task.due, done: false, priority: "Normal" }] }));
            setTask({ ...task, title: "" });
          }}>
            <input className="field" placeholder="New task" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} aria-label="Task" />
            <input type="date" className="field w-40" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} aria-label="Due date" />
            <Button type="submit" size="sm" variant="outline"><Plus /></Button>
          </form>
        </Panel>

        <Panel title="Family" sub="Birthdays, relationships and contact details">
          <ul className="divide-y divide-border/70">
            {h.people.map((p) => {
              const bd = nextBirthday(p.dob);
              return (
                <li key={p.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="text-[13.5px] font-medium">{p.name}</div><div className="text-[11.5px] text-muted-foreground">{p.relationship} · age {ageOn(p.dob)}{p.income ? ` · earns $${(p.income / 1000).toFixed(0)}K` : ""}</div></div>
                    {bd <= 30 && <Pill kind="gold"><Cake className="mr-1 size-3" />{bd === 0 ? "Today" : `${bd} days`}</Pill>}
                  </div>
                  {(p.email || p.phone || p.note) && (
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-muted-foreground">
                      {p.email && <span className="flex items-center gap-1"><Mail className="size-3" />{p.email}</span>}
                      {p.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{p.phone}</span>}
                      {p.note && <span>{p.note}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Documents" sub={h.beneficiaryReview ? `Beneficiary designations confirmed ${date(h.beneficiaryReview)}` : "Beneficiary designations not on file"}>
          <ul className="divide-y divide-border/70">
            {(h.documents ?? []).map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0 text-[13px]"><div className="truncate" title={d.name}>{d.name}</div><div className="text-[11.5px] text-muted-foreground">{d.status === "Signed" ? "Signed" : d.status === "Awaiting signature" ? "Sent" : "Last updated"} {date(d.date)}</div></div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill kind={d.status === "Signed" ? "Compliant" : d.status === "Awaiting signature" ? "Watch" : "neutral"}>{d.status}</Pill>
                  {d.status === "Awaiting signature" && <button className="text-[11.5px] text-gold hover:underline" onClick={() => update((x) => ({ ...x, documents: (x.documents ?? []).map((y) => (y.id === d.id ? { ...y, status: "Signed", date: today() } : y)) }))}>Mark signed</button>}
                </div>
              </li>
            ))}
            {!(h.documents ?? []).length && <li className="py-2 text-[13px] text-muted-foreground">No documents tracked.</li>}
          </ul>
          <button className="mt-2 text-[12px] text-gold hover:underline" onClick={() => update((x) => ({ ...x, beneficiaryReview: today() }))}>Record beneficiary review today</button>
        </Panel>

        <Panel title="Preferences and interests">
          <ul className="flex flex-wrap gap-2">
            {h.preferences.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-[12px] ring-1 ring-border">
                {p}<button aria-label="Remove" onClick={() => update((x) => ({ ...x, preferences: x.preferences.filter((_, k) => k !== i) }))}><X className="size-3 opacity-50 hover:opacity-100" /></button>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (pref.trim()) { update((x) => ({ ...x, preferences: [...x.preferences, pref.trim()] })); setPref(""); } }}>
            <input className="field" placeholder="Add a preference, interest or restriction" value={pref} onChange={(e) => setPref(e.target.value)} aria-label="Preference" />
            <Button type="submit" size="sm" variant="outline"><Plus /></Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
