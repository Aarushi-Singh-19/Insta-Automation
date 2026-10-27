function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex min-w-0 flex-col items-start gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="break-words text-3xl font-semibold tracking-[-0.045em] text-[#191724] sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-[#777280] sm:text-lg">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export default PageHeader;
