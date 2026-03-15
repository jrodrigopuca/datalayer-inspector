/**
 * Breadcrumb component - shows path to current JSON node
 */

interface BreadcrumbProps {
  path: readonly string[];
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  if (path.length === 0) {
    return (
      <div className="text-sm text-gray-400 px-2 py-1">
        <span className="text-gray-200">root</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-400 px-2 py-1 overflow-x-auto">
      <button
        onClick={() => onNavigate(-1)}
        className="text-gray-200 hover:text-brand-primary"
      >
        root
      </button>
      {path.map((segment, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronIcon className="w-3 h-3" />
          <button
            onClick={() => onNavigate(index)}
            className={
              index === path.length - 1
                ? "text-brand-primary"
                : "text-gray-200 hover:text-brand-primary"
            }
          >
            {segment}
          </button>
        </span>
      ))}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
