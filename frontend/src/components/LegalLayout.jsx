import { Link } from "react-router-dom";

function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <Link
            to="/"
            className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent"
          >
            TriggerDM
          </Link>

          <Link
            to="/"
            className="text-gray-600 hover:text-purple-600 transition"
          >
            ← Back Home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-10 shadow-sm">
          <h1 className="text-4xl font-bold text-gray-900">
            {title}
          </h1>

          <p className="mt-3 text-gray-500">
            Last Updated: {updated}
          </p>

          <div className="prose prose-gray mt-10 max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LegalLayout;