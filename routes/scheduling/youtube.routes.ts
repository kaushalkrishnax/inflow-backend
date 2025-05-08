import express from "express"
import multer from "multer"
import { scheduleVideo, scheduleLive, setOAuthToken, getScheduledMedia, getYoutubeBucketUrl } from "../../controllers/scheduling/yt/yt.controller"

const YoutubeSchedulingRouter = express.Router()
const upload = multer({ dest: "uploads/yt/" })

YoutubeSchedulingRouter.post("/auth/set-token", setOAuthToken)
YoutubeSchedulingRouter.post("/schedule/video",upload.any(), scheduleVideo)
YoutubeSchedulingRouter.post("/schedule/live", scheduleLive)
YoutubeSchedulingRouter.get("/scheduled", getScheduledMedia)
YoutubeSchedulingRouter.post("/url", getYoutubeBucketUrl)

export default YoutubeSchedulingRouter
