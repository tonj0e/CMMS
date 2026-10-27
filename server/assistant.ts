/**
 * Complaint assistant: answers plain-English questions such as "how many serious complaints came today?".
 * It is rule based (keywords -> filters -> counts from the database), so answers are exact, instant and need no AI service.
 * Staff are answered from all complaints; students only from their own.
 */

export type AssistantRow = {
  id: number;
  consumerId: string;
  title: string;
  status: "Pending" | "In Progress" | "Resolved" | "Withdrawn";
  priority: "Low" | "Medium" | "High" | "Critical";
  category: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAdminId: number | null;
};

export type AssistantData = {
  role: "staff" | "student";
  complaints: AssistantRow[];
  /** Real status changes / assignments (not the initial submission), used for "updated today". */
  changes: { complaintId: number; at: Date }[];
  /** Unread messages waiting for this viewer, per complaint. */
  unreadByComplaint: Map<number, number>;
  /** When students sent messages (staff view only), used for "new messages today". */
  studentMessageTimes: Date[];
};

export type AssistantAnswer = {
  text: string;
  stats?: { label: string; value: number }[];
  complaints?: { id: number; consumerId: string; title: string; status: string; priority: string }[];
  suggestions: string[];
};

type Window = "today" | "yesterday" | "week" | "month" | "all";
type Status = AssistantRow["status"];
type Severity = "serious" | "critical" | "minor";

export type Interpreted = {
  intent: "count" | "summary" | "unread" | "messages" | "unassigned" | "oldest" | "latest" | "help" | "howto" | "greeting" | "thanks";
  window: Window;
  windowGiven: boolean;
  field: "created" | "updated";
  status?: Status;
  /** "open", "unresolved", "outstanding": Pending or In Progress. */
  openOnly?: boolean;
  severity?: Severity;
  category?: string;
  topic?: "track" | "submit" | "withdraw" | "chat" | "time";
};

const SERIOUS: AssistantRow["priority"][] = ["High", "Critical"];
const MINOR: AssistantRow["priority"][] = ["Low", "Medium"];
const OPEN: Status[] = ["Pending", "In Progress"];
const DAY = 86_400_000;

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
const has = (text: string, pattern: RegExp) => pattern.test(text);

export function interpret(question: string, categories: string[] = []): Interpreted {
  const q = normalise(question);

  let window: Window = "all";
  let windowGiven = true;
  if (has(q, /\byesterday\b|\bprevious day\b/)) window = "yesterday";
  else if (has(q, /\btoday\b|\btonight\b|\bthis morning\b|\bthis evening\b/)) window = "today";
  else if (has(q, /\bweek\b|\b7 days\b|\bseven days\b/)) window = "week";
  else if (has(q, /\bmonth\b|\b30 days\b/)) window = "month";
  else windowGiven = false;

  const field: Interpreted["field"] = has(q, /\bupdat|\bchanged\b|\bworked on\b|\btouched\b|\bmodified\b/) ? "updated" : "created";

  let status: Status | undefined;
  if (has(q, /\bin progress\b|\bin-progress\b|\bongoing\b|\bactive\b|\bbeing worked\b|\bunder way\b/)) status = "In Progress";
  else if (has(q, /\bresolved\b|\bsolved\b|\bclosed\b|\bdone\b|\bcompleted\b|\bfixed\b/)) status = "Resolved";
  else if (has(q, /\bwithdrawn\b|\bwithdrew\b|\bcancel/)) status = "Withdrawn";
  else if (has(q, /\bpending\b|\bwaiting\b|\bnot started\b|\bunattended\b|\bnew ones\b/)) status = "Pending";

  const openOnly = !status && has(q, /\bopen\b|\bunresolved\b|\bnot resolved\b|\boutstanding\b|\bremaining\b|\bstill\b/);

  let severity: Severity | undefined;
  if (has(q, /\bnot serious\b|\bnon[- ]?serious\b|\bminor\b|\blow\b|\bnormal\b|\bnot urgent\b|\bless serious\b|\bnot important\b|\bnot critical\b/)) severity = "minor";
  else if (has(q, /\bcritical\b/)) severity = "critical";
  else if (has(q, /\bserious\b|\burgent\b|\bhigh\b|\bimportant\b|\bsevere\b|\bemergency\b|\bpriority\b/)) severity = "serious";

  const category = categories.find(c => c && q.includes(c.toLowerCase()));

  const base = { window, windowGiven, field, status, openOnly, severity, category };

  if (has(q, /^(hi|hello|hey|hii|good (morning|afternoon|evening))\b/) && q.split(" ").length <= 4) return { ...base, intent: "greeting" };
  if (has(q, /\b(thanks?|thank you|thanku|thx|great|awesome)\b/) && q.split(" ").length <= 6) return { ...base, intent: "thanks" };
  if (has(q, /\bhow (do|can|to)\b.*\b(track|follow)\b|\btracking number\b|\bwhere (is|can i see) my\b/)) return { ...base, intent: "howto", topic: "track" };
  if (has(q, /\bhow (do|can|to)\b.*\b(submit|file|raise|register|complain)\b/)) return { ...base, intent: "howto", topic: "submit" };
  if (has(q, /\bhow (do|can|to)\b.*\b(withdraw|cancel)\b/)) return { ...base, intent: "howto", topic: "withdraw" };
  if (has(q, /\bhow (do|can|to)\b.*\b(chat|message|reply|talk)\b/)) return { ...base, intent: "howto", topic: "chat" };
  if (has(q, /\bhow long\b|\bwhen will\b|\bresolution time\b/)) return { ...base, intent: "howto", topic: "time" };
  if (has(q, /\bhelp\b|\bwhat can you\b|\bwhat do you\b|\bcommands?\b|\boptions\b|\bexamples?\b/)) return { ...base, intent: "help" };
  if (has(q, /\bsummary\b|\boverview\b|\breport\b|\bsnapshot\b|\beverything\b|\bstatistics\b|\bstats\b|\bdashboard\b/)) return { ...base, intent: "summary" };
  if (has(q, /\bunassigned\b|\bnot assigned\b|\bno one assigned\b|\bnobody assigned\b/)) return { ...base, intent: "unassigned" };
  if (has(q, /\boldest\b|\blongest\b|\bwaiting longest\b|\bmost overdue\b/)) return { ...base, intent: "oldest" };
  // A date plus message words ("new messages today", "chats yesterday") is a count in that period, not the unread queue.
  if (windowGiven && has(q, /\bchats?\b|\bmessages?\b|\bchatters?\b|\bconversations?\b/) && !has(q, /\bunread\b|\bunanswered\b/)) return { ...base, intent: "messages" };
  if (has(q, /\bunread\b|\bunanswered\b|\bneed(s)? (a )?repl|\bnew repl|\bany repl|\bnew messages?\b/)) return { ...base, intent: "unread" };
  if (has(q, /\bchats?\b|\bmessages?\b|\bchatters?\b|\breplies\b|\bconversations?\b/)) return { ...base, intent: windowGiven ? "messages" : "unread" };
  if (has(q, /\blatest\b|\blast\b|\bnewest\b|\brecent\b|\bmost recent\b/) && !status && !severity) return { ...base, intent: "latest" };
  return { ...base, intent: "count" };
}

// ---------------------------------------------------------------- time windows

function bounds(window: Window, tzOffsetMinutes: number, now: Date): { from: Date; to: Date } | null {
  if (window === "all") return null;
  const offset = tzOffsetMinutes * 60_000;
  const todayStart = Math.floor((now.getTime() - offset) / DAY) * DAY + offset;
  const tomorrow = todayStart + DAY;
  if (window === "today") return { from: new Date(todayStart), to: new Date(tomorrow) };
  if (window === "yesterday") return { from: new Date(todayStart - DAY), to: new Date(todayStart) };
  if (window === "week") return { from: new Date(todayStart - 6 * DAY), to: new Date(tomorrow) };
  return { from: new Date(todayStart - 29 * DAY), to: new Date(tomorrow) };
}

const inside = (date: Date, range: { from: Date; to: Date } | null) => !range || (date >= range.from && date < range.to);

// ---------------------------------------------------------------- wording

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const priorityRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const WINDOW_TEXT: Record<Window, { created: string; updated: string }> = {
  today: { created: "filed today", updated: "updated today" },
  yesterday: { created: "filed yesterday", updated: "updated yesterday" },
  week: { created: "filed in the last 7 days", updated: "updated in the last 7 days" },
  month: { created: "filed in the last 30 days", updated: "updated in the last 30 days" },
  all: { created: "", updated: "that have been updated" },
};

function describe(i: Interpreted) {
  const parts: string[] = [];
  if (i.severity === "serious") parts.push("serious");
  if (i.severity === "critical") parts.push("critical");
  if (i.severity === "minor") parts.push("not serious");
  if (i.status === "Pending") parts.push("pending");
  if (i.status === "In Progress") parts.push("in-progress");
  if (i.status === "Resolved") parts.push("resolved");
  if (i.status === "Withdrawn") parts.push("withdrawn");
  if (i.openOnly) parts.push("open");
  return { adjectives: parts.join(" "), where: i.category ? ` in ${i.category}` : "", when: WINDOW_TEXT[i.window][i.field] };
}

const toItem = (c: AssistantRow) => ({ id: c.id, consumerId: c.consumerId, title: c.title, status: c.status, priority: c.priority });
const sortForList = (rows: AssistantRow[]) => [...rows].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.createdAt.getTime() - a.createdAt.getTime());

const STAFF_SUGGESTIONS = ["How many complaints came today?", "How many are pending?", "Show serious complaints", "Show summary"];
const STUDENT_SUGGESTIONS = ["What is the status of my latest complaint?", "How many of my complaints are pending?", "Do I have new replies?", "Show summary"];

const SEVERITY_NOTE = "Serious means High or Critical priority; not serious means Low or Medium.";

// ---------------------------------------------------------------- answering

export function answer(question: string, data: AssistantData, tzOffsetMinutes = 0, now = new Date()): AssistantAnswer {
  const staff = data.role === "staff";
  const categories = Array.from(new Set(data.complaints.map(c => c.category)));
  const i = interpret(question, categories);
  const suggestions = staff ? STAFF_SUGGESTIONS : STUDENT_SUGGESTIONS;
  const who = staff ? "There" : "You have";

  const openCount = (rows: AssistantRow[]) => rows.filter(c => OPEN.includes(c.status));
  const createdIn = (window: Window) => data.complaints.filter(c => inside(c.createdAt, bounds(window, tzOffsetMinutes, now)));
  const updatedIn = (window: Window) => {
    const range = bounds(window, tzOffsetMinutes, now);
    const ids = new Set(data.changes.filter(ch => inside(ch.at, range)).map(ch => ch.complaintId));
    return data.complaints.filter(c => ids.has(c.id));
  };

  switch (i.intent) {
    case "greeting":
      return { text: staff ? "Hi! I can tell you how many complaints came in, what is pending, what is serious and what needs a reply. What would you like to know?" : "Hi! Ask me about your complaints, their status or your replies.", suggestions };

    case "thanks":
      return { text: "You're welcome! Ask me anything else about your complaints.", suggestions };

    case "help":
      return {
        text: staff
          ? "I can answer questions like:\n• How many complaints came today / yesterday?\n• How many are pending / in progress / resolved?\n• How many serious (High/Critical) or not serious complaints?\n• Which complaints were updated today?\n• How many unread messages? Any unassigned complaints?\n• Which complaint has waited the longest?\nYou can also combine them: “serious pending complaints today”."
          : "I can answer questions like:\n• What is the status of my latest complaint?\n• How many of my complaints are pending or resolved?\n• Do I have new replies from staff?\n• How do I track, submit or withdraw a complaint?",
        suggestions,
      };

    case "howto": {
      const text = {
        track: "Open “Track complaint” in the sidebar and enter your tracking number (it looks like CCMS-2026-123456). You will see the current status, the progress steps and the full history.",
        submit: "Open “Submit complaint”, choose a category, describe the problem, optionally attach a photo or PDF and press Submit. You will get a tracking number straight away.",
        withdraw: "Open the complaint and press “Withdraw”. You can only withdraw a complaint that is still Pending.",
        chat: "Open “Track complaint”, pick your complaint and use the Messages box at the bottom to write to staff. Their replies appear there too.",
        time: "Resolution time depends on the issue. Staff will update the status and may message you; track it any time under “Track complaint”.",
      }[i.topic ?? "track"];
      return { text, suggestions };
    }

    case "summary": {
      const rows = data.complaints;
      const unread = Array.from(data.unreadByComplaint.values()).reduce((a, b) => a + b, 0);
      const stats = staff
        ? [
            { label: "Filed today", value: createdIn("today").length },
            { label: "Filed yesterday", value: createdIn("yesterday").length },
            { label: "Updated today", value: updatedIn("today").length },
            { label: "Pending", value: rows.filter(c => c.status === "Pending").length },
            { label: "In progress", value: rows.filter(c => c.status === "In Progress").length },
            { label: "Resolved", value: rows.filter(c => c.status === "Resolved").length },
            { label: "Serious (open)", value: openCount(rows).filter(c => SERIOUS.includes(c.priority)).length },
            { label: "Not serious (open)", value: openCount(rows).filter(c => MINOR.includes(c.priority)).length },
            { label: "Unassigned (open)", value: openCount(rows).filter(c => c.assignedAdminId === null).length },
            { label: "Unread messages", value: unread },
          ]
        : [
            { label: "Total", value: rows.length },
            { label: "Pending", value: rows.filter(c => c.status === "Pending").length },
            { label: "In progress", value: rows.filter(c => c.status === "In Progress").length },
            { label: "Resolved", value: rows.filter(c => c.status === "Resolved").length },
            { label: "Withdrawn", value: rows.filter(c => c.status === "Withdrawn").length },
            { label: "Unread replies", value: unread },
          ];
      const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return { text: `Here is your snapshot as of ${time}.${staff ? ` ${SEVERITY_NOTE}` : ""}`, stats, suggestions };
    }

    case "unread": {
      const total = Array.from(data.unreadByComplaint.values()).reduce((a, b) => a + b, 0);
      if (total === 0) return { text: staff ? "No unread messages. Every student message has been read." : "You have no new replies.", suggestions };
      const rows = data.complaints.filter(c => (data.unreadByComplaint.get(c.id) ?? 0) > 0);
      return {
        text: staff ? `${plural(total, "unread message")} from students across ${plural(rows.length, "complaint")}.` : `You have ${plural(total, "new reply", "new replies")} from staff.`,
        complaints: rows.slice(0, 5).map(toItem),
        suggestions,
      };
    }

    case "messages": {
      if (!staff) return { text: "Open “Track complaint” to read your conversation with staff.", suggestions };
      const range = bounds(i.window, tzOffsetMinutes, now);
      const count = data.studentMessageTimes.filter(t => inside(t, range)).length;
      const unread = Array.from(data.unreadByComplaint.values()).reduce((a, b) => a + b, 0);
      return { text: `${plural(count, "message")} from students ${i.window === "all" ? "in the last 30 days" : i.window === "week" ? "in the last 7 days" : i.window}. ${unread ? `${plural(unread, "message")} still unread.` : "All are read."}`, suggestions };
    }

    case "unassigned": {
      if (!staff) return { text: "I can only check assignments for staff accounts.", suggestions };
      const rows = openCount(data.complaints).filter(c => c.assignedAdminId === null);
      return { text: rows.length ? `${plural(rows.length, "open complaint")} ${rows.length === 1 ? "has" : "have"} no staff member assigned.` : "Every open complaint has a staff member assigned.", complaints: sortForList(rows).slice(0, 5).map(toItem), suggestions };
    }

    case "oldest": {
      const rows = data.complaints.filter(c => c.status === (i.status ?? "Pending")).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      if (!rows.length) return { text: `There are no ${(i.status ?? "Pending").toLowerCase()} complaints.`, suggestions };
      const days = Math.floor((now.getTime() - rows[0].createdAt.getTime()) / DAY);
      return { text: `The longest-waiting ${(i.status ?? "Pending").toLowerCase()} complaint was filed ${days === 0 ? "today" : plural(days, "day") + " ago"}.`, complaints: rows.slice(0, 3).map(toItem), suggestions };
    }

    case "latest": {
      const rows = [...data.complaints].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (!rows.length) return { text: staff ? "There are no complaints yet." : "You have not filed any complaints yet.", suggestions };
      const top = rows[0];
      return { text: staff ? `The latest complaint is ${top.consumerId}, ${top.status.toLowerCase()} with ${top.priority} priority.` : `Your latest complaint ${top.consumerId} (“${top.title}”) is ${top.status}.`, complaints: rows.slice(0, 5).map(toItem), suggestions };
    }

    case "count": {
      // "new / came / filed ..." with no date means today; a bare status question ("how many pending") means right now.
      const q = normalise(question);
      let window = i.window;
      if (!i.windowGiven && i.field === "created" && has(q, /\b(new|came|come|coming|filed|received|submitted|arrived|raised|registered)\b/)) window = "today";
      const filters: Interpreted = { ...i, window };
      let rows = filters.field === "updated" ? updatedIn(window) : createdIn(window);
      if (filters.status) rows = rows.filter(c => c.status === filters.status);
      if (filters.openOnly) rows = openCount(rows);
      if (filters.severity === "serious") rows = rows.filter(c => SERIOUS.includes(c.priority));
      if (filters.severity === "critical") rows = rows.filter(c => c.priority === "Critical");
      if (filters.severity === "minor") rows = rows.filter(c => MINOR.includes(c.priority));
      if (filters.category) rows = rows.filter(c => c.category === filters.category);

      const { adjectives, where, when } = describe(filters);
      const noun = `${adjectives ? adjectives + " " : ""}${rows.length === 1 ? "complaint" : "complaints"}`;
      const tail = `${where}${when ? " " + when : adjectives || where ? "" : " in total"}`;
      const text = rows.length === 0
        ? `${staff ? "No" : "You have no"} ${noun.replace(/complaints?$/, "complaints")}${tail}.`
        : staff
          ? `There ${rows.length === 1 ? "is" : "are"} ${rows.length} ${noun}${tail}.`
          : `${who} ${rows.length} ${noun}${tail}.`;
      const note = filters.severity ? ` ${SEVERITY_NOTE}` : "";
      const listed = sortForList(rows).slice(0, 5);
      return {
        text: text + note + (rows.length > listed.length ? ` Showing the ${listed.length} most important.` : ""),
        complaints: listed.map(toItem),
        suggestions,
      };
    }
  }
}
