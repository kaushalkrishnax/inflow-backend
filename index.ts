import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/biolink/auth.routes";
import profileRoutes from "./routes/biolink/profile.routes";
import stripeRoutes from "./routes/stripe.routes";
import instagramRoutes from "./routes/monitoring/instagram.routes";
import tiktokRoutes from "./routes/monitoring/tiktok.routes";
import youtubeRoutes from "./routes/monitoring/youtube.routes";
import regularLinksRoutes from "./routes/biolink/regularLinks.routes";
import socialLinksRoutes from "./routes/biolink/socialLinks.routes";
import hashtagRoutes from "./routes/monitoring/hashtags.routes";
import searchRoutes from "./routes/monitoring/search.routes";
import blogRoutes from "./routes/blogs.routes";
// Import the database module but don't need to assign it since it's initialized on import
import "./config/db.config";
import "./config/rdb.config";
import FacebookSchedulingRouter from "./routes/scheduling/facebook.routes";
import YoutubeSchedulingRouter from "./routes/scheduling/youtube.routes";
import { getUserProfileData } from "./controllers/biolink/userProfiles.controller";
import InstagramSchedulingRouter from "./routes/scheduling/instagram.routes";
import sitemapRoutes from "./routes/sitemap.routes";
import bodyParser from "body-parser";
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = 3000;
const allowedOrigins = [
  "https://inflow.chat",
  "https://www.inflow.chat",
  "http://localhost:5173",
];
// Middleware
app.use(cookieParser());
app.use("/webhook", bodyParser.raw({ type: "application/json" }), stripeRoutes);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// CORS Middleware
app.use((req, res, next): void => {
  const origin = req.get("Origin");

  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      console.log(
        `[DEBUG] Incoming: ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin}`
      );
      next();
    }
  } else {
    res.status(403).json({ message: "Forbidden: Access Denied" });
  }
});

// Routes

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/regular-links", regularLinksRoutes);
app.use("/api/social-links", socialLinksRoutes);

app.use("/api/monitoring/instagram", instagramRoutes);
app.use("/api/monitoring/tiktok", tiktokRoutes);
app.use("/api/monitoring/youtube", youtubeRoutes);
app.use("/api/hashtags", hashtagRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/blogs", blogRoutes);

app.use("/api/scheduling/facebook", FacebookSchedulingRouter);
app.use("/api/scheduling/youtube", YoutubeSchedulingRouter);
app.use("/api/scheduling/instagram", InstagramSchedulingRouter);

app.post("/api/getProfile", getUserProfileData);
// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", sitemapRoutes);
// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  // Import pool directly for shutdown
  const pool = await import("./config/db.config").then(
    (module) => module.default
  );
  await pool.end();
  console.log("Database pool has ended");
  process.exit(0);
});
