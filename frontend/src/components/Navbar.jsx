import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          TriggerDM
        </h2>

        <div className="flex items-center gap-8">
          <a
            href="#features"
            className="font-medium text-gray-600 transition hover:text-purple-600"
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
            <button className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 font-semibold text-white transition hover:opacity-90">
              Login
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;