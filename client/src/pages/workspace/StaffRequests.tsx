import { toast } from "sonner";
import { Check, Mail, UserRoundCheck, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { EmptyCard, QueryError, SectionHeader, timeAgo } from "@/components/workspace-ui";

/** New staff accounts wait here until an existing staff member approves them. */
export default function StaffRequests() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.staff.pendingRequests.useQuery(undefined, { refetchInterval: 15_000, retry: false });
  const review = trpc.staff.reviewRequest.useMutation({
    onSuccess: async (_, vars) => {
      await Promise.all([utils.staff.pendingRequests.invalidate(), utils.staff.listStaff.invalidate(), utils.staff.summary.invalidate(), utils.notifications.summary.invalidate(), utils.notifications.list.invalidate()]);
      toast.success(vars.decision === "approve" ? "Staff account approved" : "Request declined");
    },
    onError: err => toast.error(err.message),
  });

  if (error) return <QueryError message={error.message} onRetry={() => refetch()} />;

  return (
    <>
      <SectionHeader eyebrow="Access control" title="Staff requests" description="People who signed up as staff. They cannot see or do anything until you approve them, so only approve people you know." />
      <div className="max-w-[860px] space-y-3">
        {isLoading && [1, 2].map(i => <div key={i} className="h-[84px] animate-pulse rounded-[16px] bg-white/70" />)}
        {data?.map(person => (
          <div key={person.id} className="flex flex-col gap-4 rounded-[16px] border border-[#dbe4f1] bg-white p-4 shadow-[0_6px_24px_rgba(28,69,137,.055)] sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dbe6ff] text-[12px] font-extrabold text-[#174cb8]">{(person.name ?? "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold text-[#18366f]">{person.name ?? "No name"}</p>
                <p className="flex items-center gap-1.5 truncate text-[12px] text-[#5d729a]"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{person.email}</span></p>
                <p className="text-[11px] text-[#9aabc4]">Asked {timeAgo(person.createdAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button type="button" disabled={review.isPending} onClick={() => review.mutate({ userId: person.id, decision: "approve" })} className="h-11 rounded-xl bg-[#168052] px-5 text-[12px] font-bold hover:bg-[#126b44]"><Check className="mr-1.5 h-4 w-4" />Approve</Button>
              <Button type="button" variant="outline" disabled={review.isPending} onClick={() => { if (window.confirm(`Decline ${person.name ?? person.email}? Their request will be deleted.`)) review.mutate({ userId: person.id, decision: "reject" }); }} className="h-11 rounded-xl border-[#f2b9c2] px-5 text-[12px] font-bold text-[#bb3043] hover:bg-[#fff0f2]"><X className="mr-1.5 h-4 w-4" />Decline</Button>
            </div>
          </div>
        ))}
        {!isLoading && !data?.length && <EmptyCard icon={<UserRoundCheck className="h-10 w-10" />} title="No requests waiting">When someone signs up as staff, they appear here and you get a notification.</EmptyCard>}
      </div>
    </>
  );
}
