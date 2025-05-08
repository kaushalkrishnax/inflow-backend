import { Request, Response } from "express";
import { query } from "../config/db.config";

export async function createBlog(req:Request, res:Response){
    const {blog_data} = req.body

    if(!blog_data){
        res.status(400).json({error:"Blog data is required"})
        return 
    }

    try{
        const rows = await query(`INSERT INTO blogs (data) VALUES ($1) RETURNING id`, [blog_data])
        res.status(200).json({message:"Blog created successfully", id:rows.rows[0].id})
    }
    catch{
        res.status(500).json({error:"Failed to create blog"})
    }
}

export async function getBlogs(req:Request, res:Response){
    try{
        const rows = await query(`SELECT * FROM blogs`)
        res.status(200).json(rows.rows)
    }
    catch{
        res.status(500).json({error:"Failed to fetch blogs"})
    }
}

export async function getBlogById(req:Request, res:Response){
    const {id} = req.body

    if(!id){
        res.status(400).json({error:"Blog ID is required"})
        return 
    }

    try{
        const rows = await query(`SELECT * FROM blogs WHERE id = $1`, [id])
        if(rows.rowCount === 0){
            res.status(404).json({error:"Blog not found"})
            return 
        }
        res.status(200).json(rows.rows[0])
    }
    catch{
        res.status(500).json({error:"Failed to fetch blog"})
    }
}