import { Router } from "express"
import {
  login,
  signup,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleAuth,
  refreshToken,
  logout,
  resendVerification,
} from "../../controllers/biolink/auth.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = Router()

// Authentication routes
router.post("/signup", signup)
router.post("/login", login)
router.get("/verify-email/:token", verifyEmail)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password/:token", resetPassword)
router.post("/google", googleAuth)
router.post("/refresh-token", refreshToken)
router.post("/resend-verification", resendVerification)
router.post("/logout", authenticate, logout)

export default router

