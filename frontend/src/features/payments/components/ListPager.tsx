import { Button } from "@/components/ui/button";

export function ListPager({
  offset,
  count,
  total,
  hasMore,
  onPrevious,
  onNext,
}: {
  offset: number;
  count: number;
  total: number;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + count;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{total === 0 ? "No results" : `${from}–${to} of ${total}`}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={offset === 0} onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!hasMore} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
