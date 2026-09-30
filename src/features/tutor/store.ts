import { get, getAll, openDb, put, STORES } from "@/lib/store/db";
import { getCards, getProductionAttempts, getReviews } from "@/lib/store/repository";
import { isTutorPreferences, isTutorSession } from "./contract";
import { DEFAULT_TUTOR_PREFERENCES, tutorObservations, tutorProduction } from "./model";
import type { TutorPreferences, TutorSession } from "./types";

export async function getTutorSessions(): Promise<TutorSession[]> {
  const rows = await getAll<unknown>(STORES.tutorSessions);
  if (!rows.every(isTutorSession)) throw new Error("Um registro do tutor não pôde ser lido. Restaure um backup válido antes de continuar.");
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getTutorPreferences(): Promise<TutorPreferences> {
  const row = await get<unknown>(STORES.tutorPreferences, "preferences");
  if (row === undefined) return { ...DEFAULT_TUTOR_PREFERENCES, ignoredEvidenceIds: [] };
  if (!isTutorPreferences(row)) throw new Error("Não foi possível ler as preferências do tutor.");
  return row;
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("phraseloop:tutor-updated"));
}

export async function saveTutorPreferences(value: TutorPreferences) {
  if (!isTutorPreferences(value)) throw new Error("Preferências inválidas.");
  await put(STORES.tutorPreferences, value);
  notify();
}

/** Compare-and-swap plus evidence in ONE transaction. A second tab cannot overwrite
 * a draft or record the same attempt twice. A reminder survives abandoned follow-ups. */
export async function saveTutorSession(next: TutorSession, expectedRevision: number): Promise<void> {
  if (!isTutorSession(next) || next.revision !== expectedRevision + 1) throw new Error("Sessão inválida.");
  const db = await openDb();
  let changedEvidence = false;
  let changedSession = false;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.tutorSessions, STORES.productionAttempts], "readwrite");
    const sessions = tx.objectStore(STORES.tutorSessions);
    let conflict = false;
    const request = sessions.get(next.id);
    request.onsuccess = () => {
      const previous = request.result as TutorSession | undefined;
      if ((previous?.revision ?? 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      changedEvidence = JSON.stringify(previous?.attempts ?? []) !== JSON.stringify(next.attempts);
      changedSession = !previous || previous.phase !== next.phase || previous.savedPhraseId !== next.savedPhraseId;
      sessions.put(next);
      if (changedEvidence) for (const attempt of next.attempts) tx.objectStore(STORES.productionAttempts).put(tutorProduction(next, attempt));
      if (next.parentSessionId && next.attempts.length && !previous?.attempts.length) {
        const parent = sessions.get(next.parentSessionId);
        parent.onsuccess = () => {
          if (isTutorSession(parent.result)) sessions.put({ ...parent.result, revisitedAt: next.attempts[0].createdAt, revision: parent.result.revision + 1 });
        };
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Não foi possível salvar a sessão."));
    tx.onabort = () => reject(conflict ? new Error("Esta sessão mudou em outra janela. Reabra o tutor para carregar a versão salva; copie seu texto antes de sair.") : tx.error ?? new Error("Não foi possível salvar a sessão."));
  });
  // Autosaving each keystroke must not reload the entire learning history in every tab.
  if (changedSession || changedEvidence) notify();
  if (changedEvidence && typeof window !== "undefined") window.dispatchEvent(new Event("phraseloop:performance-evidence"));
}

export async function loadTutorMemory() {
  const [sessions, preferences, cards, production, reviews] = await Promise.all([getTutorSessions(), getTutorPreferences(), getCards(), getProductionAttempts(), getReviews()]);
  return { sessions, preferences, cards, observations: tutorObservations({ sessions, cards, production, reviews }), loadedAt: Date.now() };
}

export type TutorMemory = Awaited<ReturnType<typeof loadTutorMemory>>;
