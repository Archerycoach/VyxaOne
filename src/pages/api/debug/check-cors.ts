import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Debug endpoint to check CORS and cookie configuration
 * Access: /api/debug/check-cors
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get all headers
    const headers = req.headers;
    
    // Get cookies
    const cookies = req.cookies;
    
    // Get origin
    const origin = headers.origin || headers.referer || "unknown";
    
    // Check if Supabase cookies exist
    const hasSupabaseCookies = Object.keys(cookies).some(key => 
      key.startsWith("sb-") || key.includes("supabase")
    );
    
    // Prepare debug info
    const debugInfo = {
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        url: req.url,
        origin: origin,
        userAgent: headers["user-agent"],
      },
      cookies: {
        count: Object.keys(cookies).length,
        hasSupabaseCookies,
        cookieNames: Object.keys(cookies),
        // Don't log actual cookie values for security
      },
      headers: {
        host: headers.host,
        origin: headers.origin,
        referer: headers.referer,
        cookie: headers.cookie ? "present" : "missing",
        "user-agent": headers["user-agent"] ? "present" : "missing",
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      },
      vercel: {
        isVercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || "unknown",
        env: process.env.VERCEL_ENV || "unknown",
      },
      diagnosis: {
        status: "checking",
        issues: [] as string[],
        recommendations: [] as string[],
      },
    };
    
    // Diagnose issues
    if (!hasSupabaseCookies) {
      debugInfo.diagnosis.issues.push("No Supabase cookies found");
      debugInfo.diagnosis.recommendations.push(
        "User needs to login first to create session cookies"
      );
    }
    
    if (!headers.cookie) {
      debugInfo.diagnosis.issues.push("No Cookie header in request");
      debugInfo.diagnosis.recommendations.push(
        "Browser is not sending cookies - check browser settings or CORS configuration"
      );
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      debugInfo.diagnosis.issues.push("NEXT_PUBLIC_SUPABASE_URL not set");
      debugInfo.diagnosis.recommendations.push(
        "Add NEXT_PUBLIC_SUPABASE_URL to Vercel environment variables"
      );
    }
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      debugInfo.diagnosis.issues.push("SUPABASE_SERVICE_ROLE_KEY not set");
      debugInfo.diagnosis.recommendations.push(
        "Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables"
      );
    }
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      debugInfo.diagnosis.issues.push("Google OAuth credentials not configured");
      debugInfo.diagnosis.recommendations.push(
        "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel environment variables"
      );
    }
    
    // Set diagnosis status
    if (debugInfo.diagnosis.issues.length === 0) {
      debugInfo.diagnosis.status = "healthy";
    } else {
      debugInfo.diagnosis.status = "issues_found";
    }
    
    // Return debug info
    return res.status(200).json(debugInfo);
    
  } catch (error) {
    return res.status(500).json({
      error: "Debug check failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}