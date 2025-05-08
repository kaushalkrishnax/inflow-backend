import nodemailer from "nodemailer"

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Send verification email
export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email",
    html: `
      <div>
        <h1>Email Verification</h1>
        <p>Thank you for registering. Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

// Send password reset email
export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset Your Password",
    html: `
      <div>
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

