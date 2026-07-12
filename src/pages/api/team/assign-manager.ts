import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { consultant_id, manager_id } = req.body;

    if (!consultant_id) {
      return res.status(400).json({ error: "Consultant ID is required" });
    }

    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verificar o role do CHAMADOR aqui — a RPC corre via service-role, onde
    // auth.uid() é NULL, por isso a verificação interna dela não protege o
    // chamador. Sem isto, qualquer utilizador autenticado poderia reatribuir
    // consultores a equipas.
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "broker")) {
      return res.status(403).json({ error: "Apenas administradores podem atribuir equipas" });
    }

    // Use the SQL function to assign manager
    const { error: assignError } = await supabaseAdmin.rpc("assign_consultant_to_manager", {
      consultant_id,
      new_manager_id: manager_id || null
    });

    if (assignError) {
      console.error("Error assigning manager:", assignError);
      return res.status(403).json({ error: assignError.message });
    }

    return res.status(200).json({
      success: true,
      message: "Manager assigned successfully"
    });

  } catch (error: any) {
    console.error("Error in assign-manager handler:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}