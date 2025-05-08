import { Router } from "express";
import { generateLongLivedToken, getFacebookAuthorizationUrl } from "../../controllers/scheduling/fb/token.controller";
import { deletePost, getFacebookPages, getPageEvents, getPagePosts, getPostInsights, getReels, } from "../../controllers/scheduling/fb/page.controller";
import multer from "multer";
import { getPageInsights } from "../../controllers/scheduling/fb/analytics.controller";
import { schedulePostsForPages, scheduleFacebookReel, postFacebookStory, getScheduledJobs, cancelScheduledJob } from "../../controllers/scheduling/fb/scheduler.controller";

const upload = multer({ dest: "uploads/" });

const FacebookSchedulingRouter = Router();

FacebookSchedulingRouter.post("/auth/access-token", generateLongLivedToken);
FacebookSchedulingRouter.get("/auth/url", getFacebookAuthorizationUrl)

FacebookSchedulingRouter.get("/pages", getFacebookPages);

FacebookSchedulingRouter.get("/posts", getPagePosts);
FacebookSchedulingRouter.get("/reels", getReels);
FacebookSchedulingRouter.get("/events", getPageEvents);

FacebookSchedulingRouter.get("/insights", getPageInsights);
FacebookSchedulingRouter.get("/post-insights", getPostInsights);

FacebookSchedulingRouter.post("/schedule-post", upload.single("media"), schedulePostsForPages);
FacebookSchedulingRouter.post("/schedule-reel", upload.single("media"), scheduleFacebookReel);
FacebookSchedulingRouter.post("/post-story", upload.single("media"), postFacebookStory);
FacebookSchedulingRouter.post("/delete-post", deletePost)

FacebookSchedulingRouter.get("/scheduled", getScheduledJobs)
FacebookSchedulingRouter.post("/delete_post", cancelScheduledJob)


export default FacebookSchedulingRouter;