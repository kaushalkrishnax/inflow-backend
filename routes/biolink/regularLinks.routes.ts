import { Router } from "express"
import { authenticate } from "../../middleware/auth.middleware"


const router = Router()

// All settings routes require authentication
router.use(authenticate)

import {
  getRegularLinks,
  updateRegularLinks,
} from "../../controllers/biolink/regularLinks.controller"

// All regular link routes require authentication
router.use(authenticate)

// Get all regular links
router.get("/", getRegularLinks)

// Update (replace all) regular links
router.post("/", updateRegularLinks)

export default router
