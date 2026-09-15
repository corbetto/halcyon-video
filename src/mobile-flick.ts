/** A face contains only visible stock in one physical shelf run or fixture. */
interface FlickSlot {
  unitIdx: number;
  col: number;
  shelfIdx: number;
}

/** Settle along the visible row, or vertically within the current unit. */
export function mobileFlickTarget<T extends FlickSlot>(
  face: readonly T[], current: T, columns: number, shelves: number, reverseUnits = false,
): T | undefined {
  if (columns) {
    // Column numbers restart in every unit. Back faces encounter those units
    // in reverse order, while their columns still read left to right.
    const row = face.filter(s => s.shelfIdx === current.shelfIdx)
      .sort((a, b) => (a.unitIdx - b.unitIdx) * (reverseUnits ? -1 : 1) || a.col - b.col);
    const index = row.findIndex(s => s.unitIdx === current.unitIdx && s.col === current.col);
    if (index < 0) return undefined;
    return row[Math.max(0, Math.min(row.length - 1, index + columns))];
  }
  if (shelves) {
    const column = face.filter(s => s.unitIdx === current.unitIdx && s.col === current.col)
      .sort((a, b) => a.shelfIdx - b.shelfIdx);
    const index = column.findIndex(s => s.shelfIdx === current.shelfIdx);
    if (index < 0) return undefined;
    return column[Math.max(0, Math.min(column.length - 1, index + shelves))];
  }
  return current;
}
