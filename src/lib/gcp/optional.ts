/**
 * Local development often has Vertex credentials but no Firestore or storage
 * bucket yet. Persistence is therefore optional: when it is not configured
 * the app still reads packets and shows results, it just does not save them.
 */
export const persistenceConfigured = () =>
  Boolean(process.env.GOOGLE_CLOUD_PROJECT && process.env.PACKETS_BUCKET);

export const vertexConfigured = () => Boolean(process.env.GOOGLE_CLOUD_PROJECT);
