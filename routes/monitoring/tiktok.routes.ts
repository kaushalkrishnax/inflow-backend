import express from "express"
import * as tiktokController from "../../controllers/monitoring/tiktok.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = express.Router()

// TikTok monitoring routes
router.post("/add_user_tiktok",authenticate, tiktokController.addUser)
router.delete("/remove_user_tiktok",authenticate, tiktokController.removeUser)
router.post("/refresh_data_tiktok",authenticate, tiktokController.refreshData)
router.get("/get_data_tiktok",authenticate, tiktokController.getData)
router.get("/get_all_users_tiktok", authenticate,tiktokController.getAllUsers)
router.post("/refresh_all_tiktok", tiktokController.refreshAllData)

export default router

