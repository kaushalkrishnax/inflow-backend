import express from "express"
import * as instagramController from "../../controllers/monitoring/instagram.controller"
import { authenticate } from "../../middleware/auth.middleware"

const router = express.Router()

// Apply authentication middleware to all routes

// Instagram monitoring routes
router.post("/add_user_ig",authenticate, instagramController.addUser)
router.delete("/remove_user_ig",authenticate, instagramController.removeUser)
router.post("/refresh_data_ig",authenticate, instagramController.refreshData)
router.get("/get_data_ig",authenticate, instagramController.getData)
router.get("/get_all_users_ig",authenticate, instagramController.getAllUsers)
router.post("/refresh_all_ig", instagramController.refreshAllIGData)

export default router

