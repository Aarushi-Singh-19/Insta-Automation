function StatCard({ title, value, icon, color = "#7655db" }) {
  return (
    <div className="rounded-xl border border-[#e9e4eb] bg-white p-6 shadow-[0_2px_8px_rgba(34,25,57,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(34,25,57,0.08)]">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eee8ff]"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="mt-5">
        <h2 className="text-4xl font-semibold tracking-tight text-[#191724]">
          {value}
        </h2>
        <p className="mt-2 text-sm text-[#777280]">{title}</p>
      </div>
    </div>
  );
}

export default StatCard;
