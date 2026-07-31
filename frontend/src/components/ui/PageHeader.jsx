function PageHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 text-gray-500 text-lg">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

export default PageHeader;