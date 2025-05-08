import express from "express"
import { authenticate } from "../../middleware/auth.middleware"
import { generateHashtags, generateHashtagsFromImage } from "../../controllers/monitoring/hashtags.controller"

const router = express.Router()

// Apply authentication middleware to all routes

// Instagram monitoring routes
router.post("/text", authenticate, generateHashtags)
router.post("/image", authenticate, generateHashtagsFromImage)

export default router

