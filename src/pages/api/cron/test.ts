import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow all methods for testing
  if (req.method === "GET" || req.method === "POST") {
    return res.status(200).json({
      success: true,
      message: "API Route is working!",
      method: req.method,
      timestamp: new Date().toISOString(),
      headers: req.headers
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}