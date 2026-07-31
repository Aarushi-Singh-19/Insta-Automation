import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-28 text-center">

        <div className="mb-6 rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
          🚀 Instagram Comment-to-DM Automation
        </div>

        <h1 className="max-w-5xl text-6xl font-extrabold leading-tight text-gray-900">
          Turn Instagram Comments
          <br />
          Into DMs Automatically
        </h1>

        <p className="mt-8 max-w-4xl text-xl leading-8 text-gray-600">
          Automate Instagram keyword-triggered DMs, comment replies,
          and lead generation workflows.

          <br />
          <br />

          TriggerDM helps creators, coaches, agencies, and businesses
          instantly engage with people who comment on their posts and
          reels.
        </p>

        <div className="mt-10 flex gap-4">
          <Link to="/signup">
            <button className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:scale-105 hover:opacity-95">
              Start Free Trial
            </button>
          </Link>

          <a href="#features">
            <button className="rounded-xl border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition hover:bg-gray-100">
              Learn More
            </button>
          </a>
        </div>

      </div>
    </section>
  );
}

export default Hero;