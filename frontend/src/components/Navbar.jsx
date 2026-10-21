import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8 md:py-5">
        <h2 className="text-2xl font-extrabold md:text-3xl bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          TriggerDM
        </h2>

        <div className="flex items-center gap-3 sm:gap-5 md:gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 transition hover:text-purple-600 sm:text-base"
          >
            Features
          </a>

          <a
            href="#pricing"
            className="font-medium text-gray-600 transition hover:text-purple-600"
          >
            Pricing
          </a>

          <Link to="/login">
            <button className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-6 sm:py-3 sm:text-base">
              Login
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;