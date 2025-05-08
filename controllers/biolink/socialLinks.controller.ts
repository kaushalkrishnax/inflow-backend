import type { Request, Response } from "express"
import { query } from "../../config/db.config"

// GET all social links for a user
export const getSocialLinks = async (req: Request, res: Response) => {
  const userId = req.user?.userId

  if (!userId) { res.status(401).json({ message: "Unauthorized" })
    return
}

  try {
    const result = await query(
      `SELECT * FROM social_links WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    )
    console.log(result.rows,"fioofehoife")
    res.status(200).json(result.rows)
  } catch (err) {
    console.error("Error fetching social links:", err)
    res.status(500).json({ message: "Internal server error" })
  }
}

// REPLACE all social links (batch update)
export const updateSocialLinks = async (req: Request, res: Response) => {
  const userId = req.user?.userId
  const links = req.body.links // should be SocialLink[]

  if (!userId) {res.status(401).json({ message: "Unauthorized" })
    return
}
  if (!Array.isArray(links)) {
     res.status(400).json({ message: "Invalid links array" })
     return
  }

  try {
    await query(`DELETE FROM social_links WHERE user_id = $1`, [userId])

    const values = links.map(
      (link) =>
        `('${userId}', '${link.name}', '${link.icon}', '${link.url}')`
    )

    if (values.length > 0) {
      const insertQuery = `
        INSERT INTO social_links (user_id, name, icon, url)
        VALUES ${values.join(", ")}
      `
      await query(insertQuery)
    }

    res.status(200).json({ message: "Social links updated successfully" })
  } catch (err) {
    console.error("Error updating social links:", err)
    res.status(500).json({ message: "Internal server error" })
  }
}
