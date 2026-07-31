function StatCard({ title, value, icon, color = "#7C3AED" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100"
        style={{ color }}
      >
        {icon}
      </div>

      <div className="mt-5">
        <h2 className="text-4xl font-bold text-gray-900">
          {value}
        </h2>

        <p className="mt-2 text-gray-500">
          {title}
        </p>
      </div>
    </div>
  );
}

export default StatCard;