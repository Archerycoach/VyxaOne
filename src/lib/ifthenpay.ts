import axios from "axios";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

/**
 * Cliente ifthenpay — substitui a EuPago (ver memória do projeto para o
 * histórico). Diferenças estruturais importantes, confirmadas a partir do SDK
 * PHP oficial (github.com/ifthenpay/ifthenpay-sdk-php), porque a documentação
 * pública é uma SPA em JS que não dá para ler por scraping:
 *
 * 1. NÃO há sandbox — um único URL serve testes e produção. Para testar antes
 *    de teres chaves próprias, usa as chaves de demonstração públicas da
 *    ifthenpay (ex.: MB WAY 203039212; Multibanco entidade 11604 / sub 999 —
 *    confirma-as no teu contrato, podem mudar).
 * 2. Uma CHAVE POR MÉTODO (mbWayKey, mbKey, creditCardKey), não uma chave
 *    única — geridas em Admin › Definições de Pagamento.
 * 3. O callback é um GET com parâmetros na query string, curtos e cifrados
 *    (val=montante, oid=orderId, tid=transactionId, ref=referência,
 *    apk=chave anti-phishing) — não um POST com corpo JSON.
 */

const IFTHENPAY_API = "https://api.ifthenpay.com";

const getIfthenpay = async () => {
  const cfg = await getPaymentConfig();
  return {
    mbwayKey: cfg.ifthenpayMbwayKey || "",
    mbKey: cfg.ifthenpayMbKey || "",
    creditCardKey: cfg.ifthenpayCreditCardKey || "",
    antiPhishingKey: cfg.ifthenpayAntiPhishingKey || "",
  };
};

const ifthenpayError = (error: any): string => {
  const data = error?.response?.data;
  if (data) return typeof data === "string" ? data : JSON.stringify(data);
  return error?.message || "erro desconhecido";
};

const toValue = (amount: number) => Number(Number(amount).toFixed(2)).toFixed(2);

export const ifthenpay = {
  // POST /spg/payment/mbway — corpo confirmado via MbwayInitRequest::toPayload()
  // do SDK oficial: { mbWayKey, orderId, amount, mobileNumber, description, email }.
  createMBWayPayment: async ({
    amount,
    phone,
    reference,
    description,
  }: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }) => {
    const { mbwayKey } = await getIfthenpay();
    if (!mbwayKey) {
      throw new Error("Chave MB WAY da ifthenpay não configurada (Admin › Definições de Pagamento).");
    }

    // A ifthenpay espera o número nacional com indicativo colado, formato
    // "351#9XXXXXXXX" segundo os exemplos oficiais — sem "+" nem espaços.
    const nationalPhone = String(phone).replace(/\D/g, "").slice(-9);

    const body = {
      mbWayKey: mbwayKey,
      orderId: reference,
      amount: toValue(amount),
      mobileNumber: `351#${nationalPhone}`,
      description: description.slice(0, 100),
    };
    try {
      console.log("[ifthenpay] MB WAY request:", JSON.stringify({ ...body, mbWayKey: "***" }));
      const response = await axios.post(`${IFTHENPAY_API}/spg/payment/mbway`, body, {
        headers: { "Content-Type": "application/json" },
      });

      const d = response.data || {};
      console.log("[ifthenpay] MB WAY response:", JSON.stringify(d));

      if (d.Status && String(d.Status).toLowerCase() !== "pending" && String(d.Message || "").toLowerCase().includes("erro")) {
        throw new Error(d.Message || "Pedido MB WAY rejeitado.");
      }

      return {
        success: true,
        transactionId: d.RequestId || d.TransactionId || d.transactionId,
        reference,
        message: d.Message || "Pagamento MBWay iniciado.",
      };
    } catch (error: any) {
      const detail = ifthenpayError(error);
      console.error("Error creating MB WAY payment:", detail);
      throw new Error(`Erro MB WAY: ${detail}`);
    }
  },

  // POST /multibanco/reference/init — corpo confirmado via
  // MultibancoDynamicInitRequest::toPayload(): { mbKey, orderId, amount,
  // description, expiryDays }. "Dynamic" gera a referência do lado da
  // ifthenpay (sem colisões), ao contrário da geração local antiga.
  createMultibancoReference: async ({
    amount,
    reference,
    description,
  }: {
    amount: number;
    reference: string;
    description: string;
  }) => {
    const { mbKey } = await getIfthenpay();
    if (!mbKey) {
      throw new Error("Chave Multibanco da ifthenpay não configurada.");
    }

    const body = {
      mbKey,
      orderId: reference,
      amount: toValue(amount),
      description: description.slice(0, 255),
      expiryDays: 7, // mesma validade que a EuPago comunicava ao cliente
    };
    const safeBody = { ...body, mbKey: "***" };
    try {
      console.log("[ifthenpay] Multibanco request:", JSON.stringify(safeBody));
      const response = await axios.post(`${IFTHENPAY_API}/multibanco/reference/init`, body, {
        headers: { "Content-Type": "application/json" },
      });

      const d = response.data || {};
      console.log("[ifthenpay] Multibanco response:", JSON.stringify(d));

      if (!d.Entity && !d.entity) {
        throw new Error(d.Message || d.message || "A ifthenpay não devolveu entidade/referência.");
      }

      return {
        success: true,
        entity: d.Entity || d.entity,
        reference: d.Reference || d.reference,
        amount: Number(d.Amount || d.amount) || Number(toValue(amount)),
        expiryDate: d.ExpiryDate || d.expiryDate || null,
        transactionId: d.RequestId || d.TransactionId || d.transactionId,
      };
    } catch (error: any) {
      const detail = ifthenpayError(error);
      console.error("Error creating Multibanco reference:", detail, "sent:", JSON.stringify(safeBody));
      throw new Error(`Erro Multibanco: ${detail}`);
    }
  },

  // POST /creditcard/init/{creditCardKey} — a chave vai no URL, tal como a
  // do PayByLink (/gateway/pinpay/{GATEWAY_KEY}, esse confirmado num artigo
  // estático do helpdesk). Não vi um exemplo estático equivalente para o
  // cartão — este endpoint deve ser confirmado em sandbox antes de ativar em
  // produção (ver checklist). Corpo confirmado via CreditCardInitRequest.
  createCreditCardPayment: async ({
    amount,
    reference,
    successUrl,
    failUrl,
  }: {
    amount: number;
    reference: string;
    description: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
  }) => {
    const { creditCardKey } = await getIfthenpay();
    if (!creditCardKey) {
      throw new Error("Chave Cartão de Crédito da ifthenpay não configurada.");
    }

    const body = {
      orderId: reference,
      amount: toValue(amount),
      successUrl,
      errorUrl: failUrl,
      cancelUrl: failUrl,
      language: "PT",
    };
    try {
      console.log("[ifthenpay] CreditCard request:", JSON.stringify(body));
      const response = await axios.post(
        `${IFTHENPAY_API}/creditcard/init/${encodeURIComponent(creditCardKey)}`,
        body,
        { headers: { "Content-Type": "application/json" } }
      );

      const d = response.data || {};
      console.log("[ifthenpay] CreditCard response:", JSON.stringify(d));
      const url = d.RedirectUrl || d.redirectUrl || d.Url || d.url;
      if (!url) throw new Error("A ifthenpay não devolveu o URL do formulário de cartão.");
      return { success: true, url, reference };
    } catch (error: any) {
      const detail = ifthenpayError(error);
      console.error("Error creating credit card payment:", detail, "sent:", JSON.stringify(body));
      throw new Error(`Erro cartão: ${detail}`);
    }
  },
};

/**
 * Valida um callback da ifthenpay pela chave anti-phishing (campo `apk`),
 * definida em Admin › Definições de Pagamento e registada na ifthenpay
 * (backoffice ou pedido de ativação do callback) para cada método.
 */
export const verifyIfthenpayCallback = async (antiPhishingKeyReceived: string | undefined): Promise<boolean> => {
  const { antiPhishingKey } = await getIfthenpay();
  if (!antiPhishingKey) {
    throw new Error("Chave anti-phishing da ifthenpay não configurada.");
  }
  return !!antiPhishingKeyReceived && antiPhishingKeyReceived === antiPhishingKey;
};
