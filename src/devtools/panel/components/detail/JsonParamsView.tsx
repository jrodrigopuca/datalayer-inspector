/**
 * JsonParamsView component - analyst-friendly parameter table
 *
 * Renders the event payload the way an analyst reads GA4: scalar
 * parameters as rows, ecommerce items as a table. No JSON braces.
 */

import { cn } from "@/lib/utils";

interface JsonParamsViewProps {
  data: Record<string, unknown>;
}

/** Preferred item columns, shown first when present (GA4 order) */
const PREFERRED_ITEM_COLUMNS = [
  "item_id",
  "item_name",
  "price",
  "quantity",
  "item_brand",
  "item_category",
  "item_variant",
  "discount",
];

/**
 * Render a scalar-ish value for a table cell
 */
function formatCellValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 60 ? `${json.slice(0, 57)}…` : json;
  } catch {
    return "[object]";
  }
}

function valueColor(value: unknown): string {
  if (value === null || value === undefined) return "text-gray-500";
  switch (typeof value) {
    case "string":
      return "text-green-400";
    case "number":
      return "text-blue-400";
    case "boolean":
      return "text-purple-400";
    default:
      return "text-gray-400";
  }
}

/**
 * Key/value rows for scalar parameters
 */
function ParamRows({ params }: { params: Array<[string, unknown]> }) {
  return (
    <table className="w-full text-sm font-mono">
      <tbody>
        {params.map(([key, value]) => (
          <tr
            key={key}
            className="border-b border-panel-border/50 last:border-b-0"
          >
            <td className="py-1 pr-4 text-sky-400 whitespace-nowrap align-top">
              {key}
            </td>
            <td className={cn("py-1 break-all", valueColor(value))}>
              {formatCellValue(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Items rendered as a table with a stable, GA4-first column order
 */
function ItemsTable({ items }: { items: Array<Record<string, unknown>> }) {
  // Union of keys across all items
  const allKeys = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      allKeys.add(key);
    }
  }

  const columns = [
    ...PREFERRED_ITEM_COLUMNS.filter((key) => allKeys.has(key)),
    ...[...allKeys]
      .filter((key) => !PREFERRED_ITEM_COLUMNS.includes(key))
      .sort(),
  ];

  return (
    <div className="overflow-x-auto border border-panel-border rounded">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-panel-surface text-left">
            <th className="px-2 py-1 text-gray-500 font-medium">#</th>
            {columns.map((column) => (
              <th
                key={column}
                className="px-2 py-1 text-gray-400 font-medium whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: items are positional and have no stable identity
              key={index}
              className="border-t border-panel-border/50"
            >
              <td className="px-2 py-1 text-gray-600">{index + 1}</td>
              {columns.map((column) => (
                <td
                  key={column}
                  className={cn(
                    "px-2 py-1 whitespace-nowrap",
                    valueColor(item[column])
                  )}
                >
                  {formatCellValue(item[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-2xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">
      {children}
    </h3>
  );
}

export function JsonParamsView({ data }: JsonParamsViewProps) {
  const { event: _event, ecommerce, ...rest } = data;

  const topLevelParams = Object.entries(rest);

  const ecommerceObj =
    ecommerce !== null &&
    typeof ecommerce === "object" &&
    !Array.isArray(ecommerce)
      ? (ecommerce as Record<string, unknown>)
      : null;

  const ecommerceParams = ecommerceObj
    ? Object.entries(ecommerceObj).filter(([key]) => key !== "items")
    : [];

  const rawItems = ecommerceObj?.items;
  const items = Array.isArray(rawItems)
    ? rawItems.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item)
      )
    : [];

  const isEmpty =
    topLevelParams.length === 0 && !ecommerceObj && items.length === 0;

  if (isEmpty) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500">
        No parameters in this event
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 space-y-4">
      {/* Top-level parameters */}
      {topLevelParams.length > 0 && (
        <section>
          <SectionTitle>Parameters</SectionTitle>
          <ParamRows params={topLevelParams} />
        </section>
      )}

      {/* Ecommerce parameters */}
      {ecommerceParams.length > 0 && (
        <section>
          <SectionTitle>Ecommerce</SectionTitle>
          <ParamRows params={ecommerceParams} />
        </section>
      )}

      {/* Items table */}
      {items.length > 0 && (
        <section>
          <SectionTitle>Items ({items.length})</SectionTitle>
          <ItemsTable items={items} />
        </section>
      )}
    </div>
  );
}
