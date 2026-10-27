import {
  Bot,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Hash,
  MessageSquare,
} from "lucide-react";

function AutomationCard({ automation, onEdit, onDelete }) {
  const active = automation.status === "active";
  const keywords = Array.isArray(automation.keywords) ? automation.keywords : [];

  return (
    <article className="group min-w-0 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Bot size={19} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {keywords.length > 0 ? keywords[0] : "Any comment automation"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Instagram automation</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>
          {active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {active ? "Active" : automation.status || "Inactive"}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Keywords</p>
          <p className="text-sm leading-5 text-slate-700">
            {keywords.length ? keywords.join(", ") : <span className="text-slate-400">Any comment</span>}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3.5">
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Match</p>
            <p className="flex items-center gap-1.5 text-sm text-slate-700">
              <Hash size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{automation.matchType || "Any"}</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Trigger</p>
            <p className="truncate text-sm text-slate-700">
              {automation.triggerType === "specific-post" ? "Specific post" : automation.triggerType || "Comment"}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <MessageSquare size={13} /> DM message
          </p>
          <p className="line-clamp-2 min-h-10 break-words text-sm leading-5 text-slate-600">
            {automation.dmMessage || "No message configured"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => onEdit(automation)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-200 hover:bg-violet-100"
        >
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(automation._id)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
        >
          <Trash2 size={15} aria-hidden="true" /> Delete
        </button>
      </div>
    </article>
  );
}

export default AutomationCard;
