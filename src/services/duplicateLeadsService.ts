import { supabase } from "@/integrations/supabase/client";
import { getAllLeads, type LeadWithContacts } from "./leadsService";
import { nameSimilarity, POSSIBLE_DUPLICATE_THRESHOLD } from "@/lib/nameSimilarity";

export interface DuplicateLeadGroup {
  key: string;
  leads: LeadWithContacts[];
  /**
   * "certain"  — partilham telefone ou email (praticamente de certeza a mesma pessoa)
   * "possible" — nomes muito parecidos, contactos não coincidem (rever antes de fundir)
   */
  confidence?: "certain" | "possible";
  /** Porque é que estas leads foram agrupadas — mostrado ao consultor. */
  reason?: string;
}

// Últimos 9 dígitos (números de telemóvel/fixo PT) — ignora indicativo (+351,
// 00351), espaços e traços, para apanhar duplicados com formatação diferente.
const normalizePhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
};

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
};

export const findDuplicateLeadGroups = async (): Promise<DuplicateLeadGroup[]> => {
  const leads = await getAllLeads(false);

  // Union-Find: duas leads ficam no mesmo grupo se partilharem telefone OU
  // email, mesmo que seja através de uma terceira lead (cadeia A-B-C).
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byPhone = new Map<string, string[]>();
  const byEmail = new Map<string, string[]>();

  for (const lead of leads) {
    find(lead.id);
    const phone = normalizePhone(lead.phone);
    const email = normalizeEmail(lead.email);

    if (phone) {
      const existing = byPhone.get(phone) || [];
      existing.forEach((otherId) => union(lead.id, otherId));
      existing.push(lead.id);
      byPhone.set(phone, existing);
    }
    if (email) {
      const existing = byEmail.get(email) || [];
      existing.forEach((otherId) => union(lead.id, otherId));
      existing.push(lead.id);
      byEmail.set(email, existing);
    }
  }

  const groups = new Map<string, LeadWithContacts[]>();
  for (const lead of leads) {
    const root = find(lead.id);
    const group = groups.get(root) || [];
    group.push(lead);
    groups.set(root, group);
  }

  const certainGroups: DuplicateLeadGroup[] = Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      confidence: "certain" as const,
      reason: "Partilham telefone ou email",
      leads: group.sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      ),
    }));

  // Leads já agrupadas por contacto não voltam a ser sugeridas por nome.
  const alreadyGrouped = new Set(certainGroups.flatMap((g) => g.leads.map((l) => l.id)));

  return [...certainGroups, ...findPossibleDuplicatesByName(leads, alreadyGrouped)];
};

/**
 * Pares com nomes muito parecidos cujos contactos não coincidem — tipicamente a
 * mesma pessoa registada com um email diferente, ou com uma gralha no nome.
 *
 * Guarda contra falsos positivos: se AMBAS as leads têm telefone E email
 * preenchidos e AMBOS diferem, são quase de certeza pessoas diferentes com o
 * mesmo nome, e não são sugeridas. O caso que interessa apanhar é aquele em
 * que um dos contactos falta ou tem gralha.
 */
function findPossibleDuplicatesByName(
  leads: LeadWithContacts[],
  alreadyGrouped: Set<string>
): DuplicateLeadGroup[] {
  const candidates = leads.filter((lead) => !alreadyGrouped.has(lead.id) && lead.name);
  const pairs: DuplicateLeadGroup[] = [];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];

      if (nameSimilarity(a.name, b.name) < POSSIBLE_DUPLICATE_THRESHOLD) continue;

      const phoneA = normalizePhone(a.phone);
      const phoneB = normalizePhone(b.phone);
      const emailA = normalizeEmail(a.email);
      const emailB = normalizeEmail(b.email);

      const phonesConflict = !!phoneA && !!phoneB && phoneA !== phoneB;
      const emailsConflict = !!emailA && !!emailB && emailA !== emailB;
      if (phonesConflict && emailsConflict) continue;

      pairs.push({
        key: `name:${a.id}:${b.id}`,
        confidence: "possible",
        reason: "Nomes muito parecidos, contactos não coincidem",
        leads: [a, b].sort(
          (x, y) => new Date(x.created_at || 0).getTime() - new Date(y.created_at || 0).getTime()
        ),
      });
    }
  }

  return pairs;
}

export const mergeLeads = async (primaryId: string, duplicateId: string): Promise<void> => {
  const { error } = await (supabase.rpc as any)("merge_leads", {
    p_primary_id: primaryId,
    p_duplicate_id: duplicateId,
  });
  if (error) throw error;
};
