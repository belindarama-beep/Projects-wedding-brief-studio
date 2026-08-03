export type DocumentImage = {
  id: string;
  url: string;
  alt: string;
};

/** 1 -> 5+ absorbs without a different template: rows of at most 3, last row 2 if it divides evenly. */
function rowCounts(total: number): number[] {
  if (total <= 3) return [total];
  if (total === 4) return [2, 2];
  if (total === 5) return [3, 2];
  const rows: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const take = Math.min(3, remaining);
    rows.push(take);
    remaining -= take;
  }
  return rows;
}

function groupImages(images: DocumentImage[]): DocumentImage[][] {
  const groups: DocumentImage[][] = [];
  let cursor = 0;
  for (const count of rowCounts(images.length)) {
    groups.push(images.slice(cursor, cursor + count));
    cursor += count;
  }
  return groups;
}

export function ImageGrid({ images }: { images: DocumentImage[] }) {
  if (images.length === 0) return null;

  const rows = groupImages(images);

  return (
    <div className="wbs-image-grid">
      {rows.map((rowImages) => (
        <div
          key={rowImages.map((image) => image.id).join("-")}
          className="wbs-image-row"
          style={{ gridTemplateColumns: `repeat(${rowImages.length}, 1fr)` }}
        >
          {rowImages.map((image) => (
            <div
              key={image.id}
              className="wbs-image-slot"
              style={{ height: images.length === 1 ? 260 : 150 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
