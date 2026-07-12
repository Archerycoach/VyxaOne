import { supabase } from "@/integrations/supabase/client";

// Autenticação de dois fatores (2FA) via TOTP, usando o MFA nativo do
// Supabase — sem criptografia própria. TOTP = app autenticadora (Google
// Authenticator, Authy, etc.). Ver login.tsx (desafio no login) e
// TwoFactorSettings.tsx (ativação/desativação).

export interface TotpEnrollment {
  factorId: string;
  qrCode: string; // SVG (data URL) para mostrar como <img>
  secret: string; // chave manual, caso não consiga ler o QR
  uri: string;
}

// Fatores TOTP já verificados na conta do utilizador atual.
export const listVerifiedTotpFactors = async (): Promise<{ id: string; friendlyName: string | null }[]> => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp || [])
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null }));
};

// Inicia a inscrição de um novo fator TOTP. Devolve o QR/segredo para o
// utilizador registar na app autenticadora. Só fica ativo depois de
// verifyTotpEnrollment com um código válido.
export const enrollTotp = async (friendlyName = "Autenticador"): Promise<TotpEnrollment> => {
  // Limpar qualquer fator "unverified" pendente de uma tentativa anterior,
  // senão o Supabase recusa nova inscrição com o mesmo nome.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const stale = (existing?.all || []).filter((f) => f.status === "unverified");
  for (const f of stale) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
};

// Confirma a inscrição validando um código da app autenticadora.
export const verifyTotpEnrollment = async (factorId: string, code: string): Promise<void> => {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) throw verifyError;
};

// Desativa (remove) um fator TOTP.
export const unenrollFactor = async (factorId: string): Promise<void> => {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
};

// Completa o desafio de 2FA no login: valida o código e eleva a sessão a AAL2.
export const challengeAndVerifyTotp = async (factorId: string, code: string): Promise<void> => {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw error;
};

// Estado de garantia de autenticação da sessão atual.
// - precisa2FA: o utilizador tem 2FA ativo mas ainda não o completou nesta sessão.
export const getMfaStatus = async (): Promise<{
  currentLevel: string | null;
  nextLevel: string | null;
  precisa2FA: boolean;
}> => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  const currentLevel = data?.currentLevel ?? null;
  const nextLevel = data?.nextLevel ?? null;
  return {
    currentLevel,
    nextLevel,
    precisa2FA: nextLevel === "aal2" && currentLevel === "aal1",
  };
};

// Fator TOTP verificado a usar no desafio de login (o primeiro verificado).
export const getPrimaryVerifiedFactorId = async (): Promise<string | null> => {
  const factors = await listVerifiedTotpFactors();
  return factors[0]?.id ?? null;
};
