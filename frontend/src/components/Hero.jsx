import { Link } from "react-router-dom";
import { ArrowRight, Play, MessageCircle, Heart, Send, Search, Zap, Users, ChartNoAxesColumnIncreasing } from "lucide-react";

function Hero() {
  return (
    <section className="overflow-hidden bg-[radial-gradient(ellipse_at_18%_15%,rgba(237,233,254,0.8),transparent_38%),linear-gradient(180deg,#fcfbff_0%,#f8f9ff_100%)]">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-10 lg:py-24">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3.5 py-2 text-xs font-semibold text-violet-700 shadow-sm sm:text-sm">
            <MessageCircle size={16} strokeWidth={2} /> Instagram Comment-to-DM Automation
          </div>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[58px]">
            Turn comments into <span className="text-violet-600">conversations.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Automatically reply to Instagram comments and send DMs, deliver links, and capture leads while you focus on creating.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(109,40,217,0.2)] transition hover:-translate-y-0.5 hover:bg-violet-700">
              Start free <ArrowRight size={17} />
            </Link>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-violet-200 hover:bg-violet-50">
              <Play size={16} className="text-violet-600" /> See how it works
            </a>
          </div>
          <div className="mt-4 text-xs font-medium text-slate-500">7-day free trial <span className="mx-2 text-slate-300">•</span> No credit card required</div>
        </div>
        <div className="relative mx-auto w-full max-w-[590px] lg:ml-auto">
          <div className="absolute -inset-5 rounded-[34px] bg-gradient-to-br from-violet-200/70 via-white to-fuchsia-100/80 blur-2xl" />
          <div className="relative rounded-[28px] border border-white bg-white/80 p-3 shadow-[0_25px_70px_rgba(70,54,125,0.13)] sm:p-4">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/>
              <span className="ml-3 text-xs font-medium text-slate-400">TriggerDM · Live workflow preview</span>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-[0.9fr_1.1fr] sm:gap-4 sm:p-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"><MessageCircle size={15}/></span><div><p className="text-xs font-semibold text-slate-900">Instagram</p><p className="text-[10px] text-slate-400">Post preview</p></div></div>
                <div className="relative flex aspect-[4/4.3] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 via-rose-50 to-amber-100">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.9),transparent_42%)]"/>
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-white/60 shadow-inner sm:h-28 sm:w-28"><MessageCircle size={46} strokeWidth={1.25} className="text-violet-500"/></div>
                  <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">New Reel</span>
                </div>
                <div className="flex items-center gap-3 py-3 text-slate-700"><Heart size={16}/><MessageCircle size={16}/><Send size={16}/></div>
                <div className="text-[11px] leading-5 text-slate-500"><span className="font-semibold text-slate-800">creator_account</span> Comment “LINK” to get the details.</div>
              </div>
              <div className="flex flex-col justify-center gap-4 py-2 sm:py-5">
                <div className="ml-auto inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs font-medium text-violet-800 shadow-sm"><Search size={15}/> Comment detected: <strong>LINK</strong></div>
                <div className="flex justify-center text-violet-400"><div className="h-7 w-px border-l-2 border-dashed border-violet-300"/></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-4">
                  <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">T</span><div><p className="text-xs font-semibold text-slate-900">triggerdm.in</p><p className="text-[10px] text-slate-400">Business chat</p></div><span className="ml-auto text-[10px] text-emerald-600">Automated</span></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs leading-5 text-slate-700">Hey! Thanks for your interest. Here's the link you requested.</p><div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Send size={17}/></div><div className="min-w-0"><p className="text-xs font-semibold text-slate-800">Your resource</p><p className="truncate text-[10px] text-slate-400">yourwebsite.com/resource</p></div></div><div className="mt-2 rounded-lg bg-violet-600 py-2 text-center text-xs font-semibold text-white">View resource</div></div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-400">Message... <Send size={13} className="ml-auto text-slate-500"/></div>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Workflow completed</div>
              </div>
            </div>
          </div>
        </div>

      </div>
      <div id="features" className="border-t border-slate-200/70 bg-white/85">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:grid-cols-3 sm:px-8 sm:py-8 lg:px-10">
          {[
            { Icon: Zap, title: "More engagement", body: "Instant replies keep your audience interested." },
            { Icon: Users, title: "Grow your audience", body: "Turn comments into followers and loyal customers." },
            { Icon: ChartNoAxesColumnIncreasing, title: "Save time", body: "Automate repetitive DMs and focus on creating." },
          ].map(({ Icon, title, body }, index) => (
            <div key={title} className={index > 0 ? "flex items-start gap-4 sm:border-l sm:border-slate-200 sm:pl-7" : "flex items-start gap-4"}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Icon size={21} strokeWidth={1.8} /></span>
              <div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 max-w-xs text-sm leading-5 text-slate-500">{body}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;