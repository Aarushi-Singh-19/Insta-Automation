import { Instagram, SlidersHorizontal, MessageCircle, Send } from "lucide-react";

const steps = [
  { Icon: Instagram, number: "01", title: "Connect Instagram", description: "Link the Instagram account you want to grow." },
  { Icon: SlidersHorizontal, number: "02", title: "Set your trigger", description: "Choose a post and the keyword or comment rule." },
  { Icon: MessageCircle, number: "03", title: "Someone comments", description: "TriggerDM detects a matching comment." },
  { Icon: Send, number: "04", title: "A DM is delivered", description: "Your configured message is sent automatically." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-slate-100 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Simple by design</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">From comment to conversation</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Set up your workflow once. TriggerDM takes care of the repetitive follow-up.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ Icon, number, title, description }) => (
            <article key={number} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="mb-6 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Icon size={20} strokeWidth={1.8}/></span>
                <span className="text-xs font-semibold tracking-[0.12em] text-slate-300">{number}</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export default HowItWorks;