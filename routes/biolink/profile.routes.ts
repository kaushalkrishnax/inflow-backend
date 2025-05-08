import { Router } from "express"
import { getUserSettings, updateUserSettings } from "../../controllers/biolink/profile.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = Router()

// All settings routes require authentication
router.use(authenticate)

// Get user settings
router.get("/", getUserSettings)

// Update user settings
router.post("/", updateUserSettings)

export default router