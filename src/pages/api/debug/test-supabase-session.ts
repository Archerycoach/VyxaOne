import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Debug endpoint to test Supabase session validation
 * Access: /api/debug/test-supabase-session
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("🔍 Testing Supabase session...");
    
    // Try to get session from cookies
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!sessionData.session,
        hasUser: !!sessionData.session?.user,
        userId: sessionData.session?.user?.id || null,
        userEmail: sessionData.session?.user?.email || null,
        expiresAt: sessionData.session?.expires_at || null,
        error: sessionError?.message || null,
      },
      cookies: {
        received: !!req.headers.cookie,
        cookieHeader: req.headers.cookie ? "present" : "missing",
        parsedCookies: Object.keys(req.cookies),
        hasSupabaseCookies: Object.keys(req.cookies).some(key => 
          key.startsWith("sb-") || key.includes("supabase")
        ),
      },
      diagnosis: {
        status: "checking",
        issues: [] as string[],
        recommendations: [] as string[],
      },
    };
    
    // Diagnose issues
    if (sessionError) {
      debugInfo.diagnosis.issues.push(`Session error: ${sessionError.message}`);
      debugInfo.diagnosis.recommendations.push("Check Supabase configuration and credentials");
    }
    
    if (!sessionData.session) {
      debugInfo.diagnosis.issues.push("No active session found");
      debugInfo.diagnosis.recommendations.push("User needs to login to create a session");
    }
    
    if (!req.headers.cookie) {
      debugInfo.diagnosis.issues.push("No cookies in request");
      debugInfo.diagnosis.recommendations.push("Browser is not sending cookies - check CORS and credentials");
    }
    
    if (!debugInfo.cookies.hasSupabaseCookies) {
      debugInfo.diagnosis.issues.push("No Supabase cookies found");
      debugInfo.diagnosis.recommendations.push("Session cookies were not created during login");
    }
    
    // Set diagnosis status
    if (debugInfo.diagnosis.issues.length === 0) {
      debugInfo.diagnosis.status = "healthy";
    } else {
      debugInfo.diagnosis.status = "issues_found";
    }
    
    return res.status(200).json(debugInfo);
    
  } catch (error) {
    return res.status(500).json({
      error: "Session test failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}