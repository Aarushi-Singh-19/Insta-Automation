import {
  MessageCircle,
  Bot,
 KeyRound,
  TrendingUp,
} from "lucide-react";

function Features() {
  const features = [
    {
      title: "Keyword Triggers",
      description:
        "Automatically trigger workflows when users comment keywords like 'price', 'link', 'ebook', or any custom phrase.",
      icon: <KeyRound size={26} />,
    },
    {
      title: "Instant Auto DMs",
      description:
        "Send personalized Instagram DMs the moment someone comments on your post or reel.",
      icon: <MessageCircle size={26} />,
    },
    {
      title: "Smart Auto Replies",
      description:
        "Reply publicly to comments while simultaneously delivering a private DM.",
      icon: <Bot size={26} />,
    },
    {
      title: "Lead Generation",
      description:
        "Convert Instagram engagement into qualified leads automatically without manual effort.",
      icon: <TrendingUp size={26} />,
    },
  ];

  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-8">

        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-gray-900">
            Everything You Need
          </h2>

          <p className="mt-4 text-lg text-gray-500">
            Powerful automation tools built for creators,
            businesses and agencies.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                {feature.icon}
              </div>

              <h3 className="mb-3 text-xl font-bold text-gray-900">
                {feature.title}
              </h3>

              <p className="leading-7 text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Features;