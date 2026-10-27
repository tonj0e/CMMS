import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { STATUS_TRANSITIONS, type ComplaintStatus } from "@shared/ccms";
import ComplaintChat from "@/components/ComplaintChat";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Tag,
  AlertTriangle,
  User,
  Shield,
  Paperclip,
  Download,
  Copy,
  Check,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Pending: "border-[#c6d6ff] bg-[#eef3ff] text-[#204eb7]",
  "In Progress": "border-[#b8dff5] bg-[#e9f7ff] text-[#14729c]",
  Resolved: "border-[#bce5d4] bg-[#edfbf3] text-[#18794e]",
  Withdrawn: "border-[#f2b9c2] bg-[#fff0f2] text-[#bb3043]",
};

const priorityStyles: Record<string, string> = {
  Low: "border-slate-200 bg-slate-50 text-slate-500",
  Medium: "border-[#d8cafa] bg-[#f5f0ff] text-[#6e47b8]",
  High: "border-[#f5d2a4] bg-[#fff5e8] text-[#b46317]",
  Critical: "border-[#f2b9c2] bg-[#fff0f2] text-[#bb3043]",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", statusStyles[status] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "Resolved" ? "bg-[#27a76c]" : status === "In Progress" ? "bg-[#1897cb]" : status === "Pending" ? "bg-[#336edb]" : "bg-[#bb3043]")} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", priorityStyles[priority] ?? priorityStyles.Medium)}>
      {priority}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, className = "" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 text-[12px] text-[#5d729a]", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9aabc4]" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8ba9e9]">{label}</p>
        <p className="text-[12px] font-medium text-[#18366f]">{value}</p>
      </div>
    </div>
  );
}

export default function ComplaintDetail() {
  const params = useParams();
  const complaintId = params.id ? parseInt(params.id, 10) : null;

  const utils = trpc.useUtils();
  const { data: detail, isLoading, error, refetch } = trpc.complaints.detail.useQuery(
    { id: complaintId! },
    { enabled: !!complaintId, retry: false }
  );

  const { data: user } = trpc.auth.me.useQuery(undefined, { retry: false });
  const isAdmin = user?.role === "admin";

  // Status update mutation for staff
  const updateStatusMutation = trpc.staff.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.complaints.detail.invalidate({ id: complaintId! });
      await utils.staff.list.invalidate();
      await utils.staff.summary.invalidate();
      await utils.notifications.list.invalidate();
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const withdrawMutation = trpc.complaints.withdraw.useMutation({
    onSuccess: async () => {
      await utils.complaints.detail.invalidate({ id: complaintId! });
      await utils.complaints.mine.invalidate();
      await utils.notifications.list.invalidate();
      toast.success("Complaint withdrawn");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="blueprint-app min-h-dvh bg-[#061b56]">
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/30 border-t-white" />
            <p className="text-[13px] font-bold">Loading complaint...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="blueprint-app min-h-dvh bg-[#061b56]">
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-6">
          <div className="text-center text-white">
            <AlertTriangle className="mx-auto h-12 w-12 text-[#9fc4ff]" />
            <h1 className="mt-4 text-[18px] font-extrabold">Complaint not found</h1>
            <p className="mt-2 text-[#9fc4ff]">This complaint may have been removed or you don't have permission to view it.</p>
            <Link href="/workspace" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[12px] font-extrabold text-[#174cb8] hover:bg-[#edf3ff]">
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { complaint, history, attachments } = detail;

  return (
    <div className="blueprint-app min-h-dvh bg-[#061b56]">
      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-9">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/workspace"
              className="tap-area mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2458c4] hover:text-[#102c6b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to list
            </Link>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9dbdff]">Complaint Detail</p>
            <h1 className="mt-2 text-[27px] font-extrabold tracking-[-.055em] text-white sm:text-[31px]">{complaint.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[#d7e2f4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#6b7e9d]">
              <Copy className="h-3.5 w-3.5" />
              <span onClick={() => { navigator.clipboard.writeText(complaint.consumerId); toast.success("Copied!"); }} className="cursor-pointer">{complaint.consumerId}</span>
            </div>
            {!isAdmin && complaint.status === "Pending" && (
              <button
                type="button"
                disabled={withdrawMutation.isPending}
                onClick={() => { if (window.confirm("Withdraw this complaint? This cannot be undone.")) withdrawMutation.mutate({ complaintId: complaint.id }); }}
                className="rounded-xl border border-[#f1c9c9] bg-white px-3 py-2 text-[11px] font-bold text-[#a33a3a] hover:bg-[#fff6f6] disabled:opacity-50"
              >
                Withdraw
              </button>
            )}
            {isAdmin && (
              <select
                value={complaint.status}
                onChange={(e) => updateStatusMutation.mutate({ complaintId: complaint.id, status: e.target.value as any, remarks: "Updated via detail page" })}
                disabled={updateStatusMutation.isPending}
                className="rounded-xl border border-[#d7e2f4] bg-white px-3 py-2 text-[11px] font-bold text-[#18366f] focus:outline-none focus:ring-2 focus:ring-[#3971d7]"
              >
                {(["Pending", "In Progress", "Resolved", "Withdrawn"] as ComplaintStatus[]).map(status => (
                  <option key={status} value={status} disabled={status !== complaint.status && !(STATUS_TRANSITIONS[complaint.status as ComplaintStatus] ?? []).includes(status)}>{status}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Status & Meta */}
            <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <CardContent className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                  {complaint.isAnonymous && (
                    <Badge variant="outline" className="border-[#f2b9c2] bg-[#fff0f2] text-[#bb3043]">
                      <Shield className="mr-1 h-3 w-3" />
                      Anonymous
                    </Badge>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoRow icon={Tag} label="Category" value={complaint.category} />
                  <InfoRow icon={MapPin} label="Location" value={complaint.location} />
                  <InfoRow icon={Clock} label="Submitted" value={format(new Date(complaint.createdAt), "PPP 'at' p")} />
                  <InfoRow icon={Clock} label="Last Updated" value={format(new Date(complaint.updatedAt), "PPP 'at' p")} />
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <CardHeader className="border-b border-[#e5ebf3] px-5 py-4">
                <CardTitle className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Description</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-[12px] leading-6 text-[#4a5a7a] whitespace-pre-wrap">{complaint.description}</p>
              </CardContent>
            </Card>

            {/* Attachments */}
            {attachments.length > 0 && (
              <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
                <CardHeader className="border-b border-[#e5ebf3] px-5 py-4">
                  <CardTitle className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Attachments ({attachments.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    {attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-[#dce5f1] bg-white p-3 hover:border-[#7fa4e6] hover:bg-[#f5f8ff] transition"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf3ff] text-[#2458c4]">
                          {att.mimeType.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-[#18366f]">{att.fileName}</p>
                          <p className="text-[10px] text-[#8b9ab3]">{(att.sizeBytes / 1024).toFixed(1)} KB · {att.mimeType}</p>
                        </div>
                        <Download className="h-5 w-5 text-[#9aabc4] hover:text-[#2458c4]" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status History */}
            <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <CardHeader className="border-b border-[#e5ebf3] px-5 py-4">
                <CardTitle className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Status Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#e0e7f2]" />
                  {history.map((entry, index) => (
                    <div key={entry.id} className="relative mb-6 last:mb-0 pl-14">
                      <div className="absolute left-[-6px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#174cb8] ring-1 ring-[#bcd0f4]" />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[12px] font-bold text-[#18366f]">
                            {entry.newStatus}
                            {index === 0 && <span className="ml-2 rounded-full bg-[#2aad75] px-1.5 py-0.5 text-[8px] font-bold text-white">Current</span>}
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold text-[#6b82ae]">{format(new Date(entry.changedAt), "PPP 'at' p")}</p>
                          {entry.remarks && <p className="mt-1 text-[11px] leading-5 text-[#8291aa]">{entry.remarks}</p>}
                        </div>
                        {entry.changedByUserId && (
                          <Badge variant="outline" className="text-[10px]">
                            Updated by staff
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Student Info (Admin only) */}
            {isAdmin && (
              <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
                <CardHeader className="border-b border-[#e5ebf3] px-5 py-4">
                  <CardTitle className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Student Information</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-[14px] font-extrabold">ID</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-extrabold text-[#102c6b]">
                        {complaint.isAnonymous ? "Anonymous student" : complaint.studentRef ? `Student ID: ${complaint.studentRef}` : "No Student ID on record"}
                      </p>
                      <p className="text-[11px] text-[#8b9ab3]">
                        {complaint.isAnonymous ? "The student chose to stay anonymous." : "Staff can only see the Student ID."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversation between the student and staff */}
            <ComplaintChat complaintId={complaint.id} viewer={isAdmin ? "staff" : "student"} closed={complaint.status === "Withdrawn"} />

            {/* Feedback */}
            {!isAdmin && complaint.status === "Resolved" && (
              <FeedbackForm complaintId={complaint.id} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <CardContent className="p-5">
                <p className="mb-4 text-[12px] font-bold uppercase tracking-[.1em] text-[#7788a5]">Quick Actions</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-3" onClick={() => navigator.clipboard.writeText(complaint.consumerId)}>
                    <Copy className="h-4 w-4" />
                    Copy Tracking ID
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                  </Button>
                  {attachments.length > 0 && (
                    <Button variant="outline" className="w-full justify-start gap-3">
                      <Download className="h-4 w-4" />
                      Download All Attachments
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Complaint Info Card */}
            <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
              <CardContent className="p-5">
                <p className="mb-4 text-[12px] font-bold uppercase tracking-[.1em] text-[#7788a5]">Complaint Info</p>
                <dl className="space-y-3 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-[#8b9ab3]">Consumer ID</dt>
                    <dd className="font-bold text-[#18366f] font-mono">{complaint.consumerId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#8b9ab3]">Internal ID</dt>
                    <dd className="font-bold text-[#18366f]">#{complaint.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#8b9ab3]">Anonymous</dt>
                    <dd className="font-bold text-[#18366f]">{complaint.isAnonymous ? "Yes" : "No"}</dd>
                  </div>
                  {complaint.resolvedAt && (
                    <div className="flex justify-between">
                      <dt className="text-[#8b9ab3]">Resolved At</dt>
                      <dd className="font-bold text-[#18366f]">{format(new Date(complaint.resolvedAt), "PPP 'at' p")}</dd>
                    </div>
                  )}
                  {complaint.assignedAdminId && (
                    <div className="flex justify-between">
                      <dt className="text-[#8b9ab3]">Assigned To</dt>
                      <dd className="font-bold text-[#18366f]">Staff #{complaint.assignedAdminId}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackForm({ complaintId }: { complaintId: number }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = trpc.complaints.feedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (submitted) {
    return (
      <Card className="border-[#bce5d4] bg-[#edfbf3] shadow-[0_6px_24px_rgba(28,69,137,.055)]">
        <CardContent className="p-5 text-center">
          <Check className="mx-auto h-10 w-10 text-[#27a76c]" />
          <p className="mt-3 text-[15px] font-extrabold text-[#183d88]">Feedback submitted!</p>
          <p className="mt-1 text-[11px] text-[#5d76a4]">Thank you for helping us improve.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#dbe4f1] bg-white shadow-[0_6px_24px_rgba(28,69,137,.055)]">
      <CardHeader className="border-b border-[#e5ebf3] px-5 py-4">
        <CardTitle className="text-[15px] font-extrabold tracking-[-.03em] text-[#102c6b]">Rate Your Experience</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div>
          <p className="mb-3 text-[12px] font-bold text-[#18366f]">How satisfied are you with the resolution?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border-2 transition text-[18px] font-bold"
                  style={{
                    borderColor: rating !== null && star <= rating ? "#2aad75" : "#dce5f1",
                    backgroundColor: rating !== null && star <= rating ? "#eafaf1" : "white",
                    color: rating !== null && star <= rating ? "#168052" : "#8da0bd",
                  }}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="feedback-comments" className="block text-[11px] font-bold text-[#5d729a]">
            Additional comments (optional)
          </label>
          <textarea
            id="feedback-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[#dce5f1] bg-white px-4 py-3 text-[12px] placeholder-[#9aabc4] focus:border-[#3971d7] focus:outline-none focus:ring-2 focus:ring-[#3971d7]/20"
            placeholder="What did we do well? What could we improve?"
            maxLength={2000}
          />
        </div>
        <Button
          className="w-full h-11 rounded-xl bg-[#174cb8] px-4 text-[12px] font-bold shadow-[0_8px_20px_rgba(23,76,184,.2)] hover:bg-[#123d9a]"
          onClick={() => {
            if (!rating) {
              toast.error("Please select a rating");
              return;
            }
            feedbackMutation.mutate({ complaintId, rating, comments });
          }}
          disabled={feedbackMutation.isPending || !rating}
        >
          {feedbackMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}