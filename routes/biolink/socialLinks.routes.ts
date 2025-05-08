import { Router } from "express"
import {
  getSocialLinks,
  updateSocialLinks,
} from "../../controllers/biolink/socialLinks.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = Router()

// All social link routes require authentication
router.use(authenticate)

// Get all social links
router.get("/", getSocialLinks)

// Update (replace all) social links
router.post("/", updateSocialLinks)

export default router
