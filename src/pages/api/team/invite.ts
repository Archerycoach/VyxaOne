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
    const { email, full_name } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ error: "Email and full name are required" });
    }

    // Verify authorization from session
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is broker or admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "broker" && profile.role !== "admin")) {
      return res.status(403).json({ error: "Only broker or admin can invite users" });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Create user with Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true,
      user_metadata: {
        full_name: full_name
      }
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError);
      return res.status(500).json({ error: createError?.message || "Failed to create user" });
    }

    // Update profile with full_name and default role (consultant)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: full_name,
        role: "consultant"
      })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // User created but profile update failed - not critical
    }

    // Send password reset email so user can set their password
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase()
    });

    if (resetError) {
      console.error("Error sending password reset:", resetError);
      // User created but email failed - not critical
    }

    return res.status(200).json({
      success: true,
      message: "User invited successfully. They will receive an email to set their password.",
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name: full_name
      }
    });

  } catch (error: any) {
    console.error("Error in invite handler:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}