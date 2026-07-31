import { Link } from "react-router-dom";
import { Check } from "lucide-react";

function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-slate-50 py-24"
    >
      <div className="mx-auto max-w-7xl px-8">

        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-gray-900">
            Simple Pricing
          </h2>

          <p className="mt-4 text-lg text-gray-500">
            Start free and upgrade when you're ready.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">

          {/* Free Trial */}

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold">
              Free Trial
            </h3>

            <p className="mt-2 text-5xl font-extrabold">
              ₹0
            </p>

            <p className="mt-1 text-gray-500">
              7 Days
            </p>

            <div className="mt-8 space-y-4">

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                100 DMs
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                1 Instagram Account
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                Basic Automation
              </div>

            </div>
          </div>

          {/* Starter */}

          <div className="rounded-3xl border-2 border-pink-500 bg-white p-8 shadow-xl">

            <div className="mb-4 inline-flex rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-600">
              Most Popular
            </div>

            <h3 className="text-2xl font-bold">
              Starter
            </h3>

            <p className="mt-2 text-5xl font-extrabold">
              ₹499
            </p>

            <p className="mt-1 text-gray-500">
              per month
            </p>

            <div className="mt-8 space-y-4">

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                1,000 DMs
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                Unlimited Campaigns
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                Priority Processing
              </div>

            </div>

            <Link to="/signup">
              <button className="mt-10 w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90">
                Start Free Trial
              </button>
            </Link>

          </div>

          {/* Growth */}

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">

            <h3 className="text-2xl font-bold">
              Growth
            </h3>

            <p className="mt-2 text-5xl font-extrabold">
              ₹999
            </p>

            <p className="mt-1 text-gray-500">
              per month
            </p>

            <div className="mt-8 space-y-4">

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                5,000 DMs
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                Unlimited Automations
              </div>

              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500" />
                Priority Support
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

export default Pricing;