import axios from "axios";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

const EUPAGO_API_URL = "https://clientes.eupago.pt/api/v1.02";

// Chave EuPago gerida em Admin › Definições de Pagamento (BD), com fallback env.
const getEupagoApiKey = async () => {
  const { eupagoApiKey } = await getPaymentConfig();
  return eupagoApiKey || "";
};

// Eupago API client
export const eupago = {
  // Create MBWay payment
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
    try {
      const apiKey = await getEupagoApiKey();
      
      if (!apiKey) {
        throw new Error("Eupago não está configurado. Configure EUPAGO_API_KEY no .env");
      }

      const response = await axios.post(`${EUPAGO_API_URL}/mbway/create`, {
        chave: apiKey,
        valor: amount.toFixed(2),
        alias: phone,
        id: reference,
        descricao: description,
      });

      if (response.data.estado === "ok") {
        return {
          success: true,
          transactionId: response.data.transacao,
          reference: response.data.referencia,
          message: response.data.mensagem,
        };
      } else {
        throw new Error(response.data.mensagem || "Erro ao criar pagamento MBWay");
      }
    } catch (error: any) {
      console.error("Error creating MBWay payment:", error);
      throw new Error(`Erro MBWay: ${error.message}`);
    }
  },

  // Create Multibanco reference
  createMultibancoReference: async ({
    amount,
    reference,
    description,
  }: {
    amount: number;
    reference: string;
    description: string;
  }) => {
    try {
      const apiKey = await getEupagoApiKey();
      
      if (!apiKey) {
        throw new Error("Eupago não está configurado");
      }

      const response = await axios.post(`${EUPAGO_API_URL}/multibanco/create`, {
        chave: apiKey,
        valor: amount.toFixed(2),
        id: reference,
        descricao: description,
      });

      if (response.data.estado === "ok") {
        return {
          success: true,
          entity: response.data.entidade,
          reference: response.data.referencia,
          amount: response.data.valor,
          expiryDate: response.data.data_fim,
        };
      } else {
        throw new Error(response.data.mensagem || "Erro ao criar referência Multibanco");
      }
    } catch (error: any) {
      console.error("Error creating Multibanco reference:", error);
      throw new Error(`Erro Multibanco: ${error.message}`);
    }
  },

  // Check payment status
  checkPaymentStatus: async (reference: string) => {
    try {
      const apiKey = await getEupagoApiKey();
      
      if (!apiKey) {
        throw new Error("Eupago não está configurado");
      }

      const response = await axios.post(`${EUPAGO_API_URL}/pedido/info`, {
        chave: apiKey,
        referencia: reference,
      });

      return {
        status: response.data.estado,
        paid: response.data.estado === "Pago",
        amount: response.data.valor,
        paidDate: response.data.data_pagamento,
      };
    } catch (error: any) {
      console.error("Error checking payment status:", error);
      throw new Error(`Erro ao verificar status: ${error.message}`);
    }
  },
};

// Verify Eupago webhook signature
export const verifyEupagoWebhook = async (payload: any, _signature: string): Promise<boolean> => {
  const apiKey = await getEupagoApiKey();

  if (!apiKey) {
    throw new Error("Chave EuPago não configurada");
  }

  // Eupago uses API key verification in the payload
  return payload.chave === apiKey;
};