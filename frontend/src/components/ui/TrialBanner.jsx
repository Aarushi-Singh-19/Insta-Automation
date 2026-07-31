import { ArrowRight } from "lucide-react";

function TrialBanner({ daysRemaining, onUpgrade }) {
  return (
    <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-amber-900">
          🚀 Free Trial Active
        </h3>

        <p className="mt-2 text-amber-700">
          {daysRemaining} day(s) remaining in your free trial.
        </p>
      </div>

      <button
        onClick={onUpgrade}
        className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 transition px-5 py-3 font-semibold text-white"
      >
        Upgrade
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default TrialBanner;