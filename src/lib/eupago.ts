import axios from "axios";

const EUPAGO_API_URL = "https://clientes.eupago.pt/api/v1.02";

// Get Eupago API key from environment
const getEupagoApiKey = () => {
  return process.env.EUPAGO_API_KEY || "";
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
      const apiKey = getEupagoApiKey();
      
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
      const apiKey = getEupagoApiKey();
      
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
      const apiKey = getEupagoApiKey();
      
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
export const verifyEupagoWebhook = (payload: any, signature: string): boolean => {
  const apiKey = getEupagoApiKey();
  
  if (!apiKey) {
    throw new Error("EUPAGO_API_KEY não configurado");
  }

  // Eupago uses API key verification in the payload
  return payload.chave === apiKey;
};