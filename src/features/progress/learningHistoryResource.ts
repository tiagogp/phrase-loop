import { isStoreAvailable } from "@/lib/store/db";
import { createSharedResource, type ResourceSnapshot } from "@/lib/store/sharedResource";
import { getCards, getListeningAttempts, getProductionAttempts, getProofAttempts, getReviews, getRetryOutcomes } from "@/lib/store/repository";
import { deriveLearningEvidence, type LearningEvidenceInput } from "./learningEvidence";

const EMPTY: LearningEvidenceInput = { cards: [], reviews: [], production: [], retries: [], listening: [], proofs: [] };
export const learningHistoryResource = createSharedResource(EMPTY, async () => {
  if (!isStoreAvailable()) throw new Error("Storage unavailable");
  const [cards, reviews, production, retries, listening, proofs] = await Promise.all([
    getCards(), getReviews(), getProductionAttempts(), getRetryOutcomes(), getListeningAttempts(), getProofAttempts(),
  ]);
  return { cards, reviews, production, retries, listening, proofs };
}, ["phraseloop:activity", "phraseloop:performance-evidence", "phraseloop:lesson-saved", "phraseloop:backup-restored", "phraseloop:profile-updated"]);

// Hook-local useMemo repeats the calculation for every mounted consumer. A weak
// snapshot cache shares it, while letting obsolete histories be garbage collected.
const evidenceBySnapshot = new WeakMap<ResourceSnapshot<LearningEvidenceInput>, ReturnType<typeof deriveLearningEvidence>>();
export function learningEvidenceFor(snapshot: ResourceSnapshot<LearningEvidenceInput>) {
  let evidence = evidenceBySnapshot.get(snapshot);
  if (!evidence) {
    evidence = deriveLearningEvidence(snapshot.data, snapshot.now);
    evidenceBySnapshot.set(snapshot, evidence);
  }
  return evidence;
}
