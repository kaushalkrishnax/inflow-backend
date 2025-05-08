import express from "express"
import { createBlog, getBlogById, getBlogs } from "../controllers/blog.controller"
const router = express.Router()

// Apply authentication middleware to all routes

// Instagram monitoring routes
router.post("/create", createBlog)
router.get("/get-all", getBlogs)
router.post("/get-by-id", getBlogById)

export default router

