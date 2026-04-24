// User profile stored in localStorage. Wraps the two shapes that exist:
// the Onboarding save (conditions + allergies only) and the Profile page
// save (conditions + allergies + language). Always returns a normalized
// shape so callers don't have to branch.

export interface UserProfile {
  conditions: string[];
  allergies: string[];
  language: "English" | "Hindi";
}

const PROFILE_KEY = "oasis-profile";

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") {
    return { conditions: [], allergies: [], language: "English" };
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { conditions: [], allergies: [], language: "English" };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions.filter((c): c is string => typeof c === "string") : [],
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies.filter((a): a is string => typeof a === "string") : [],
      language: parsed.language === "Hindi" ? "Hindi" : "English",
    };
  } catch {
    return { conditions: [], allergies: [], language: "English" };
  }
}

export function hasPersonalization(p: UserProfile): boolean {
  return p.conditions.length > 0 || p.allergies.length > 0;
}

export function saveProfile(p: UserProfile): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}
