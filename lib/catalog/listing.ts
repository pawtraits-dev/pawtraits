/**
 * Designs reachable only by link: kept out of Browse, the home page, breed/theme lists and
 * recommendations, but still open and buyable at /customise/<id>. Today that's the Pawsonality
 * breed pictures (tag 'quiz-generated', made in Admin → Quizzes → Breed pictures or for quiz takers).
 */
export const UNLISTED_TAG = 'quiz-generated';

/** PostgREST `or` filter keeping listed designs (rows with no tags count as listed) */
export const LISTED_ONLY = `tags.is.null,tags.not.cs.{${UNLISTED_TAG}}`;

/** For in-memory filtering of rows that carry `tags` */
export const isListed = (row: { tags?: string[] | null }) => !row.tags?.includes(UNLISTED_TAG);
