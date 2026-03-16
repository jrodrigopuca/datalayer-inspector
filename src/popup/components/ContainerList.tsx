/**
 * ContainerList component - shows detected GTM containers
 */

const MAX_VISIBLE_CONTAINERS = 3;

interface ContainerListProps {
  containers: readonly string[];
}

export function ContainerList({ containers }: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500 border-t border-panel-border">
        No GTM containers detected
      </div>
    );
  }

  const visibleContainers = containers.slice(0, MAX_VISIBLE_CONTAINERS);
  const hiddenCount = containers.length - MAX_VISIBLE_CONTAINERS;

  return (
    <div className="px-3 py-2 border-t border-panel-border">
      <div className="text-2xs text-gray-500 mb-1">Containers</div>
      <div className="flex flex-wrap gap-1">
        {visibleContainers.map((container) => (
          <span
            key={container}
            className="px-1.5 py-0.5 text-2xs font-mono bg-event-gtm/20 text-event-gtm rounded"
          >
            {container}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span 
            className="px-1.5 py-0.5 text-2xs text-gray-500"
            title={containers.slice(MAX_VISIBLE_CONTAINERS).join(", ")}
          >
            +{hiddenCount} more
          </span>
        )}
      </div>
    </div>
  );
}
