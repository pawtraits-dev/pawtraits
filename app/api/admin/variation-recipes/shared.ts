const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a saved batch from the admin page */
export function cleanRecipeBody(body: any): { row: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Missing body' };
  const name = String(body.name ?? '').trim().slice(0, 120);
  if (!name) return { error: 'Give the batch a name' };
  const breedCoats = (Array.isArray(body.breed_coats) ? body.breed_coats : [])
    .filter((b: any) => UUID.test(b?.breedId) && UUID.test(b?.coatId))
    .map((b: any) => ({ breedId: b.breedId, coatId: b.coatId }));
  const outfitIds = (Array.isArray(body.outfit_ids) ? body.outfit_ids : []).filter((id: any) => UUID.test(id));
  if (!breedCoats.length && !outfitIds.length) return { error: 'Choose at least one breed/coat or outfit' };
  const imageSize = ['1K', '2K', '4K'].includes(body.image_size) ? body.image_size : '4K';
  return {
    row: {
      name,
      description: body.description ? String(body.description).slice(0, 500) : null,
      breed_coats: breedCoats,
      outfit_ids: Array.from(new Set(outfitIds)),
      image_size: imageSize,
      updated_at: new Date().toISOString(),
    },
  };
}
