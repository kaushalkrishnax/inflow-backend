import { query } from "../config/db.config";
import { SitemapStream, streamToPromise } from 'sitemap';

import { Router, Request, Response } from "express";


const router = Router();

async function allUsers(){
    const res = await query(
        `SELECT unique_username FROM users`
    )

    const names = res.rows.map((row) => {
        return row.unique_username
    })

    return names
}

router.get("/sitemap.xml", async (req: Request, res: Response) => {
    res.header('Content-Type', 'application/xml');
    const sitemap = new SitemapStream({ hostname: 'https://inflow.chat' });

    sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
    sitemap.write({ url: '/login', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/register', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/forgot-password', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/privacy', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/terms', changefreq: 'monthly', priority: 0.8 });
    const users = await allUsers()
    for(const user of users){
        sitemap.write({ url: `/${user}`,  priority: 0.8 });
    }
    sitemap.end();
    const data = await streamToPromise(sitemap);
    res.send(data.toString());
})

export default router;



