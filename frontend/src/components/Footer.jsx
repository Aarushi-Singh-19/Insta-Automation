import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-8 py-10 md:flex-row">
        {/* Logo & Copyright */}
        <div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            TriggerDM
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            © {new Date().getFullYear()} TriggerDM. All rights reserved.
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-8 text-gray-600">
          <Link
            to="/privacy"
            className="transition hover:text-purple-600"
          >
            Privacy
          </Link>

          <Link
            to="/terms"
            className="transition hover:text-purple-600"
          >
            Terms
          </Link>

          <Link
            to="/contact"
            className="transition hover:text-purple-600"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;