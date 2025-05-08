import express from "express";
import * as instagramController from "../../controllers/automation/instagram.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = express.Router();

// Instagram automation routes
router.post("/add_user_ig", authenticate, instagramController.addUser);

export default router;
