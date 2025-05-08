import type { Request, Response, NextFunction } from "express"
import jwt, { TokenExpiredError } from "jsonwebtoken"
import { query } from "../config/db.config"
import type { TokenPayload } from "../types"

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
      }
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" })
      return
    }

    const userId = authHeader.split(" ")[1]

    // Verify token with proper typing
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables")
    }

    const userResult = await query("SELECT * FROM users WHERE id = $1", [userId])

    if (userResult.rows.length === 0) {
      res.status(401).json({ message: "User not found" })
      return
    }
    console.log(userId,"userId")
    // Attach user to request
    req.user = { userId: userId }

    next()
  } catch (error) {
    console.error("Authentication error:", error)
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return 
    }
    res.status(401).json({ message: "Authentication Failed" })
  }
}

