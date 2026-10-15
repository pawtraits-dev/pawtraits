/** Pawsonality type page URLs (client-safe) */
export function typeSlug(name: string): string {
  return name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'type';
}

export function typeHref(animal: 'dog' | 'cat', t: { name: string }) {
  return `/pawsonalities/${animal}/${typeSlug(t.name)}`;
}
