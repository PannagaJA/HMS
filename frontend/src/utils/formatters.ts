/**
 * Utility functions for consistent Floor and Room formatting across HMS
 */

/**
 * Formats a floor number into user-friendly text e.g. "Ground Floor", "Floor 1", "Floor 2"
 */
export function formatFloor(floor?: number | string | null, roomNo?: string | null): string | null {
  if (floor !== undefined && floor !== null && floor !== '') {
    const num = Number(floor);
    if (!isNaN(num)) {
      return num === 0 ? 'Ground Floor' : `Floor ${num}`;
    }
  }

  // Fallback: Infer floor from room number if floor is not explicitly provided
  const r = String(roomNo || '').trim();
  if (r.toUpperCase().startsWith('G')) {
    return 'Ground Floor';
  }
  if (/^\d{3,4}$/.test(r)) {
    const inf = Math.floor(Number(r) / 100);
    return inf === 0 ? 'Ground Floor' : `Floor ${inf}`;
  }

  return null;
}

/**
 * Formats floor and room into combined display e.g. "Floor 1 · Room 101" or "Ground Floor · Room G01"
 */
export function formatFloorRoom(floor?: number | string | null, roomNo?: string | null): string {
  const fStr = formatFloor(floor, roomNo);
  const rStr = roomNo ? `Room ${roomNo}` : '';

  if (fStr && rStr) {
    return `${fStr} · ${rStr}`;
  }
  if (fStr) return fStr;
  if (rStr) return rStr;
  return 'N/A';
}

/**
 * Formats floor, room, and bed into combined display e.g. "Floor 1 · Room 101 · Bed 1"
 */
export function formatFloorRoomBed(
  floor?: number | string | null,
  roomNo?: string | null,
  bed?: number | string | null
): string {
  const base = formatFloorRoom(floor, roomNo);
  if (bed !== undefined && bed !== null && bed !== '') {
    return `${base} · Bed ${bed}`;
  }
  return base;
}
