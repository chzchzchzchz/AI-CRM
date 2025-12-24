import sgMail from "@sendgrid/mail";
import { ENV } from "./env";

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@targetaccountdashboard.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!SENDGRID_API_KEY) {
      console.warn("SendGrid API key not configured. Email not sent.");
      return false;
    }

    await sgMail.send({
      to: options.to,
      from: SENDGRID_FROM_EMAIL,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Send email verification code
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Verification</h2>
      <p>Your verification code is:</p>
      <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h1 style="margin: 0; font-size: 36px; letter-spacing: 5px; color: #333;">${code}</h1>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Target Account Dashboard</p>
    </div>
  `;

  const text = `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`;

  return sendEmail({
    to: email,
    subject: "Email Verification Code",
    html,
    text,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetCode: string,
  resetLink?: string
): Promise<boolean> {
  const link = resetLink || `https://targetaccountdashboard.com/reset-password?code=${resetCode}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the link below to proceed:</p>
      <div style="margin: 20px 0;">
        <a href="${link}" style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>Or use this code: <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${resetCode}</code></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Target Account Dashboard</p>
    </div>
  `;

  const text = `We received a request to reset your password.\n\nReset code: ${resetCode}\n\nThis code will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;

  return sendEmail({
    to: email,
    subject: "Password Reset Request",
    html,
    text,
  });
}

/**
 * Send 2FA setup confirmation email
 */
export async function send2FASetupEmail(email: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Two-Factor Authentication Enabled</h2>
      <p>Two-factor authentication has been successfully enabled on your account.</p>
      <p>You will now need to enter a code from your authenticator app when logging in.</p>
      <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Keep your backup codes safe!</strong></p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">If you lose access to your authenticator app, you can use backup codes to regain access to your account.</p>
      </div>
      <p>If you didn't enable 2FA, please contact support immediately.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Target Account Dashboard</p>
    </div>
  `;

  const text = `Two-factor authentication has been successfully enabled on your account.\n\nYou will now need to enter a code from your authenticator app when logging in.`;

  return sendEmail({
    to: email,
    subject: "Two-Factor Authentication Enabled",
    html,
    text,
  });
}

/**
 * Send access request approval email
 */
export async function sendAccessApprovalEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Access Request Approved</h2>
      <p>Hi ${name},</p>
      <p>Your access request to Target Account Dashboard has been approved!</p>
      <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Login Credentials:</strong></p>
        <p style="margin: 10px 0 0 0;">Email: <code>${email}</code></p>
        <p style="margin: 5px 0 0 0;">Temporary Password: <code>${tempPassword}</code></p>
      </div>
      <p>Please log in and change your password immediately after your first login.</p>
      <div style="margin: 20px 0;">
        <a href="https://targetaccountdashboard.com/login" style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Log In Now</a>
      </div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Target Account Dashboard</p>
    </div>
  `;

  const text = `Your access request has been approved!\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password immediately.`;

  return sendEmail({
    to: email,
    subject: "Access Request Approved - Welcome to Target Account Dashboard",
    html,
    text,
  });
}

/**
 * Send access request denial email
 */
export async function sendAccessDenialEmail(
  email: string,
  name: string,
  reason?: string
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Access Request Update</h2>
      <p>Hi ${name},</p>
      <p>Thank you for your interest in Target Account Dashboard. Unfortunately, your access request has been denied at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>If you have any questions, please feel free to reach out to our support team.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Target Account Dashboard</p>
    </div>
  `;

  const text = `Thank you for your interest in Target Account Dashboard. Unfortunately, your access request has been denied at this time.${reason ? `\n\nReason: ${reason}` : ""}`;

  return sendEmail({
    to: email,
    subject: "Access Request Update",
    html,
    text,
  });
}
