import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { getClient, query } from "../../config/db.config"
import { sendVerificationEmail, sendPasswordResetEmail } from "../../services/email.service"
import { OAuth2Client } from "google-auth-library"
import type { TokenPayload } from "../../types"

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// User signup
export const signup = async (req: Request, res: Response): Promise<void> => {
  const { client, done } = await getClient()

  try {
    const { username, email, password, displayName } = req.body

    // Validate input
    if (!username || !email || !password || !displayName) {
      res.status(400).json({ message: "All fields are required" })
      return
    }

    // Check if user already exists
    const existingUserResult = await client.query("SELECT * FROM users WHERE email = $1", [email])

    if (existingUserResult.rows.length > 0) {
      res.status(409).json({ message: "User with this email already exists" })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate verification token
    const verificationToken = uuidv4()

    // Begin transaction
    await client.query("BEGIN")

    // Create user
    const newUserResult = await client.query(
      `INSERT INTO users (username, email, password, verification_token, is_verified, unique_username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [displayName, email, hashedPassword, verificationToken, false, username],
    )

    // Commit transaction
    await client.query("COMMIT")

    // Send verification email
    await sendVerificationEmail(email, verificationToken)

    // Return success response (without sensitive data)
    res.status(201).json({
      message: "User created successfully. Please verify your email.",
      userId: newUserResult.rows[0].id,
    })
  } catch (error) {
    // Rollback transaction in case of error
    await client.query("ROLLBACK")
    console.error("Signup error:", error)
    res.status(500).json({ message: "Internal server error" })
  } finally {
    done()
  }
}

// Email verification
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    // Find user with this verification token
    const userResult = await query("SELECT * FROM users WHERE verification_token = $1", [token])

    if (userResult.rows.length === 0) {
      res.status(400).json({ message: "Invalid verification token" })
      return
    }

    const user = userResult.rows[0]

    // Update user to verified
    await query("UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1", [user.id])

    // Redirect to frontend or return success
    res.status(200).json({ message: "Email verified successfully" })
  } catch (error) {
    console.error("Verification error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// User login
export const login = async (req: Request, res: Response) => {
  const { client, done } = await getClient()

  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" })
      return
    }

    // Find user
    const userResult = await client.query("SELECT * FROM users WHERE email = $1", [email])

    if (userResult.rows.length === 0) {
      res.status(401).json({ message: "Invalid credentials" })
      return
    }

    const user = userResult.rows[0]

    // Check if user is verified
    if (!user.is_verified) {
      res.status(403).json({ message: "Please verify your email before logging in" })
      return
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" })
      return
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: "15m" })

    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: "7d" })

    // Begin transaction
    await client.query("BEGIN")

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await client.query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [refreshToken, user.id, expiresAt],
    )

    // Commit transaction
    await client.query("COMMIT")

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 * 10000, // 7 days
      sameSite: "strict",
    })

    // Return access token and user info
    res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        username: user.unique_username,
        email: user.email,
        displayName: user.username
      },
    })
  } catch (error) {
    // Rollback transaction in case of error
    await client.query("ROLLBACK")
    console.error("Login error:", error)
    res.status(500).json({ message: "Internal server error" })
  } finally {
    done()
  }
}

// Forgot password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ message: "Email is required" })
      return
    }

    // Find user
    const userResult = await query("SELECT * FROM users WHERE email = $1", [email])

    if (userResult.rows.length === 0) {
      // For security reasons, don't reveal that the user doesn't exist
      res
        .status(200)
        .json({ message: "If your email exists in our system, you will receive a password reset link" })
      return
    }

    const user = userResult.rows[0]

    // Generate reset token
    const resetToken = uuidv4()
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save token to database
    await query("UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3", [
      resetToken,
      resetTokenExpiry,
      user.id,
    ])

    // Send password reset email
    await sendPasswordResetEmail(email, resetToken)

    res.status(200).json({ message: "If your email exists in our system, you will receive a password reset link" })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { password } = req.body

    if (!password) {
      res.status(400).json({ message: "New password is required" })
      return
    }

    // Find user with this reset token
    const userResult = await query("SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()", [token])

    if (userResult.rows.length === 0) {
      res.status(400).json({ message: "Invalid or expired reset token" })
      return
    }

    const user = userResult.rows[0]

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password
    await query("UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2", [
      hashedPassword,
      user.id,
    ])

    res.status(200).json({ message: "Password reset successful" })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// Google authentication
export const googleAuth = async (req: Request, res: Response) => {
  const { client, done } = await getClient()

  try {
    const { token } = req.body

    if (!token) {
      res.status(400).json({ message: "Google token is required" })
      return
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      res.status(400).json({ message: "Invalid Google token" })
      return
    }

    const { email, name, sub: googleId } = payload

    // Begin transaction
    await client.query("BEGIN")

    // Check if user exists
    const userResult = await client.query("SELECT * FROM users WHERE email = $1", [email])

    let user

    if (userResult.rows.length === 0) {
      // Create new user if doesn't exist
      const username = name || (email as string).split("@")[0] || "Google User"
      const newUserResult = await client.query(
        `INSERT INTO users (email, username, password, google_id, is_verified, unique_username)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [email, username, "", googleId, true, email.replace("@","_").replace(".com","")], // No password for Google users
      )
      user = newUserResult.rows[0]
    } else {
      user = userResult.rows[0]

      // Link Google account to existing user if not already linked
      if (!user.google_id) {
        await client.query("UPDATE users SET google_id = $1 WHERE id = $2", [googleId, user.id])
        user.google_id = googleId
      }
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: "15m" })

    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: "7d" })

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await client.query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [refreshToken, user.id, expiresAt],
    )

    // Commit transaction
    await client.query("COMMIT")

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 * 10000, // 7 days
      sameSite: "strict",
    })

    // Return access token and user info
    console.log(user)


    res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        username: user.unique_username,
        email: user.email,
        displayName: user.username
      },
    })
  } catch (error) {
    // Rollback transaction in case of error
    await client.query("ROLLBACK")
    console.error("Google auth error:", error)
    res.status(500).json({ message: "Internal server error" })
  } finally {
    done()
  }
}

// Refresh token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken

    if (!token) {
      res.status(401).json({ message: "Refresh token is required" })
      return 
    }

    // Verify token with proper typing
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as TokenPayload
    console.log(decoded.userId,"toenswdood.")
    // Check if token exists in database
    const tokenResult = await query(
      "SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2::uuid AND expires_at > NOW()",
      [token, decoded.userId],
    )

    if (tokenResult.rows.length === 0) {
      res.status(401).json({ message: "Invalid or expired refresh token" })
      return 
    }

    // Generate new access token
    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET as string, { expiresIn: "15m" })

    res.status(200).json({ accessToken })
  } catch (error) {
    console.error("Refresh token error:", error)
    res.status(401).json({ message: "Invalid refresh token" })
  }
}

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken

    if (token) {
      // Delete refresh token from database
      await query("DELETE FROM refresh_tokens WHERE token = $1", [token])

      // Clear cookie
      res.clearCookie("refreshToken")
    }

    res.status(200).json({ message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// Resend verification email
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ message: "Email is required" })
      return
    }

    // Find user
    const userResult = await query("SELECT * FROM users WHERE email = $1", [email])

    if (userResult.rows.length === 0) {
      // For security reasons, don't reveal that the user doesn't exist
      res.status(200).json({
        message: "If your email exists in our system, a verification email has been sent",
      })
      return
    }

    const user = userResult.rows[0]

    // Check if user is already verified
    if (user.is_verified) {
      res.status(400).json({ message: "Email is already verified" })
      return
    }

    // Generate new verification token if needed
    let verificationToken = user.verification_token

    if (!verificationToken) {
      verificationToken = uuidv4()
      // Save new token to database
      await query("UPDATE users SET verification_token = $1 WHERE id = $2", [verificationToken, user.id])
    }

    // Send verification email
    await sendVerificationEmail(email, verificationToken)

    res.status(200).json({
      message: "Verification email has been sent. Please check your inbox.",
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

