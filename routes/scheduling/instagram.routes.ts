import express from "express"
import { getScheduledPosts, scheduleSinglePost } from "../../controllers/scheduling/ig/ig.controller"

const InstagramSchedulingRouter = express.Router()

InstagramSchedulingRouter.post("/schedule/post", scheduleSinglePost)
InstagramSchedulingRouter.post("/scheduled-posts", getScheduledPosts)

export default InstagramSchedulingRouter
