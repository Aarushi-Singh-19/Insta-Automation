import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/" aria-label="TriggerDM home" className="text-[25px] font-extrabold tracking-[-0.06em] text-slate-950">
          Trigger<span className="text-violet-600">DM</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">Product</a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">How it works</a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden px-3 py-2 text-sm font-semibold text-slate-700 transition hover:text-violet-700 sm:inline-flex">Log in</Link>
          <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:px-5">
            Get started <ArrowRight size={15}/>
          </Link>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;