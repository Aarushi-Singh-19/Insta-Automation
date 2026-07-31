import { Link } from "react-router-dom";
import { Check } from "lucide-react";

function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-5xl px-8">

        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-gray-900">
            Simple Pricing
          </h2>

          <p className="mt-4 text-lg text-gray-500">
            Try TriggerDM free for 7 days. Upgrade anytime for just ₹99/month.
          </p>
        </div>

        <div className="mx-auto max-w-lg rounded-3xl border-2 border-pink-500 bg-white p-10 shadow-xl">

          <div className="mb-4 inline-flex rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-600">
            7-Day Free Trial
          </div>

          <h3 className="text-3xl font-bold text-gray-900">
            TriggerDM Pro
          </h3>

          <div className="mt-6">
            <p className="text-6xl font-extrabold text-gray-900">
              ₹99
            </p>

            <p className="mt-2 text-lg text-gray-500">
              per month after your free trial
            </p>
          </div>

          <div className="mt-10 space-y-5">

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              7 Days Free Trial
            </div>

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              Unlimited Comment-to-DM Automations
            </div>

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              Unlimited Campaigns
            </div>

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              Keyword Triggers
            </div>

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              Auto Replies & Auto DMs
            </div>

            <div className="flex items-center gap-3">
              <Check size={18} className="text-green-500" />
              Priority Support
            </div>

          </div>

          <Link to="/signup">
            <button className="mt-10 w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-4 text-lg font-semibold text-white transition hover:opacity-90">
              Start Free Trial
            </button>
          </Link>

        </div>

      </div>
    </section>
  );
}

export default Pricing;