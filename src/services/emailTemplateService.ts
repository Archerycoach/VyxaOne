import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmailTemplate = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  template_type: "daily_email" | "workflow" | "whatsapp";
  subject: string;
  html_body: string;
  text_body: string | null;
  available_variables: Record<string, unknown> | null;
  is_active: boolean;
  is_default: boolean;
  recipient_emails: string[] | null;
  created_at: string;
  updated_at: string;
};

export interface EmailTemplateInsert {
  name: string;
  description?: string | null;
  template_type: string;
  subject: string;
  html_body: string;
  text_body?: string | null;
  variables?: any;
  is_default?: boolean;
  is_active?: boolean;
  user_id?: string | null;
}

export interface EmailTemplateUpdate {
  name?: string;
  description?: string | null;
  template_type?: string;
  subject?: string;
  html_body?: string;
  text_body?: string | null;
  variables?: any;
  is_default?: boolean;
  is_active?: boolean;
  user_id?: string | null;
}

export const emailTemplateService = {
  // Buscar todos os templates
  async getAll(userId?: string) {
    let query = supabase
      .from("email_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.or(`user_id.eq.${userId},is_default.eq.true`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as unknown as EmailTemplate[];
  },

  // Buscar template por tipo
  async getByType(templateType: string, userId?: string) {
    let query = supabase
      .from("email_templates" as any)
      .select("*")
      .eq("template_type", templateType)
      .eq("is_active", true);

    if (userId) {
      // Priorizar template do usuário, senão pegar o padrão
      query = query.or(`user_id.eq.${userId},is_default.eq.true`);
    } else {
      query = query.eq("is_default", true);
    }

    const { data, error } = await query.order("is_default", { ascending: true }).limit(1).single();
    
    if (error && error.code !== "PGRST116") throw error;
    return data as unknown as EmailTemplate | null;
  },

  // Buscar template por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from("email_templates" as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as unknown as EmailTemplate;
  },

  // Criar novo template
  async create(template: EmailTemplateInsert) {
    const { data, error } = await supabase
      .from("email_templates" as any)
      .insert(template)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as EmailTemplate;
  },

  // Atualizar template
  async update(id: string, template: EmailTemplateUpdate) {
    const { data, error } = await supabase
      .from("email_templates" as any)
      .update({ ...template, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as EmailTemplate;
  },

  // Deletar template
  async delete(id: string) {
    const { error } = await supabase
      .from("email_templates" as any)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // Duplicar template
  async duplicate(id: string, userId: string) {
    const original = await this.getById(id);
    
    const { data, error } = await supabase
      .from("email_templates" as any)
      .insert({
        name: `${original.name} (Cópia)`,
        description: original.description,
        template_type: original.template_type,
        subject: original.subject,
        html_body: original.html_body,
        text_body: original.text_body,
        variables: original.variables,
        is_default: false,
        is_active: true,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as EmailTemplate;
  },

  // Testar template com dados de exemplo
  async preview(templateId: string, sampleData: Record<string, unknown>) {
    const template = await this.getById(templateId);
    
    return {
      subject: this.renderTemplate(template.subject, sampleData),
      html: this.renderTemplate(template.html_body, sampleData),
      text: template.text_body ? this.renderTemplate(template.text_body, sampleData) : "",
    };
  },

  // Renderizar template com dados
  renderTemplate(template: string, data: Record<string, unknown>): string {
    let result = template;
    
    // Substituir variáveis simples {{variavel}}
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, String(data[key] || ""));
    });
    
    // Processamento básico de loops (simplificado)
    // Para loops complexos como {{#each events}}...{{/each}}, seria ideal usar uma lib como Handlebars
    // Por enquanto, vamos manter simples ou implementar algo básico se necessário
    
    return result;
  },
};