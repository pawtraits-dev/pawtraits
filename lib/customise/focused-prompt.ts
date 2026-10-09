/**
 * Shorter customer-painting prompt, under test in /admin/consistency-test (not live).
 * The live prompt is ~7,500 characters, mostly repeated aspect-ratio warnings, and mixes the
 * design's style notes in with the pet's appearance. This one states the job once, puts the pet's
 * identity and body first, and keeps everything else from the design.
 */
export function buildFocusedPaintingPrompt(p: { designAnimal?: string; aspectRatio?: string }): string {
  const animal = p.designAnimal ? `the ${p.designAnimal}` : 'the animal';
  const ratio = p.aspectRatio || '2:3';
  return `Edit the first image (a finished pet portrait). Replace ${animal} in it with the pet in the second image (a photo of a customer's pet). The result is the same portrait, with the customer's pet in it.

Keep from the portrait, unchanged: the pose, position, size and framing of the animal; its outfit, accessories and props; the background, lighting, colour grading and painting style. Ignore any watermark or logo on the portrait and don't include one.

Take from the photo, faithfully: the pet's breed and build, body shape and proportions (not those of ${animal}), head shape, ears, muzzle, eyes and expression, coat length, curl and texture, and its markings and where they are. Someone who knows this pet should recognise it at once.

Coat colour: show the pet's true colour as it would look in the portrait's lighting. Phone photos are often backlit, shadowed or colour-cast, which can make a coat look darker or a different shade than it is; correct for that rather than copying it, and don't recolour the coat to suit the portrait's palette.

Ignore the photo's background, pose and framing. Output a ${ratio} image (width:height) matching the portrait's composition.`;
}
