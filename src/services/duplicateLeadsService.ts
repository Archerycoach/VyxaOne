import { supabase } from "@/integrations/supabase/client";
import { getAllLeads, type LeadWithContacts } from "./leadsService";

export interface DuplicateLeadGroup {
  key: string;
  leads: LeadWithContacts[];
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

  return Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      leads: group.sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      ),
    }));
};

export const mergeLeads = async (primaryId: string, duplicateId: string): Promise<void> => {
  const { error } = await (supabase.rpc as any)("merge_leads", {
    p_primary_id: primaryId,
    p_duplicate_id: duplicateId,
  });
  if (error) throw error;
};
