import express from "express"
import { authenticate } from "../../middleware/auth.middleware"
import { getAllLocations, searchInfluencers } from "../../controllers/monitoring/search.controller"

const router = express.Router()

// Instagram monitoring routes
router.get("/locations", authenticate, getAllLocations)
router.post("/", authenticate, searchInfluencers)

export default router

