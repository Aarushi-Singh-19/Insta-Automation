import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 md:py-28">

        <div className="mb-6 rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
          🚀 Instagram Comment-to-DM Automation
        </div>

        <h1 className="max-w-5xl text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl md:text-6xl">
          Turn Instagram Comments
          <br className="hidden sm:block" />
          Into DMs Automatically
        </h1>

        <p className="mt-6 max-w-4xl text-base leading-7 text-gray-600 sm:mt-8 sm:text-lg md:text-xl md:leading-8">
          Automate Instagram keyword-triggered DMs, comment replies,
          and lead generation workflows.

          <br />
          <br />

          TriggerDM helps creators, coaches, agencies, and businesses
          instantly engage with people who comment on their posts and
          reels.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4 md:mt-10">
          <Link to="/signup">
            <button className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-95 sm:w-auto sm:px-8 sm:py-4 sm:text-lg sm:hover:scale-105">
              Sign Up
            </button>
          </Link>

          <a href="#features">
            <button className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-100 sm:w-auto sm:px-8 sm:py-4 sm:text-lg">
              Learn More
            </button>
          </a>
        </div>

      </div>
    </section>
  );
}

export default Hero;