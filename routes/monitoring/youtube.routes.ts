import express from "express"
import * as youtubeController from "../../controllers/monitoring/youtube.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = express.Router()

// Apply authentication middleware to all routes

// YouTube monitoring routes
router.post("/add_user_youtube", authenticate, youtubeController.addUser)
router.delete("/remove_user_youtube", authenticate,youtubeController.removeUser)
router.post("/refresh_data_youtube", authenticate,youtubeController.refreshData)
router.get("/get_data_youtube", authenticate,youtubeController.getData)
router.get("/get_all_users_youtube", authenticate,youtubeController.getAllUsers)
router.post("/refresh_all_youtube", youtubeController.refreshAllYouTubeData)

export default router

