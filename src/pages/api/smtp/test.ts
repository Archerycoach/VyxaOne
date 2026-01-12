import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const {
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_username,
      smtp_password,
      reject_unauthorized,
    } = req.body;

    if (!smtp_host || !smtp_port || !smtp_username || !smtp_password) {
      return res.status(400).json({
        success: false,
        message: "Missing required SMTP configuration fields",
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port,
      secure: smtp_secure,
      auth: {
        user: smtp_username,
        pass: smtp_password,
      },
      tls: {
        rejectUnauthorized: reject_unauthorized ?? true,
      },
    });

    // Verify connection
    await transporter.verify();

    return res.status(200).json({
      success: true,
      message: "SMTP connection successful! Your settings are working correctly.",
    });
  } catch (error) {
    console.error("SMTP test error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to test SMTP connection",
    });
  }
}