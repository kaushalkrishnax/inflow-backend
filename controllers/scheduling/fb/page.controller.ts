import axios from "axios";


export async function getFacebookPages(req: any, res: any) {
    const token = req.query.access_token;

    if (!token) {
        return res.status(400).json({ error: "Access token is required." });
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v22.0/me/accounts`, {
            params: {
                access_token: token,
            },
        });
        const formatted_response = response.data.data.map((page: any) => {
            return {
                id: page.id,
                name: page.name,
                category: page.category,
                access_token: page.access_token,
            };                  
        })
        res.status(200).json(formatted_response);
    } catch (error:any) {
        console.log(error.message)
        res.status(500).json({
            error: error.response ? error.response.data : "Internal Server Error",
        });
    }
}


export const getPagePosts = async (req:any, res:any) => {
    const { page_id, page_access_token } = req.query;
    if(!page_id || !page_access_token){
      return res.status(400).json({ error: "Page ID and Access Token are required." });
    }
    try {
        const fields =
      "id,message,created_time,permalink_url,full_picture,attachments,status";
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${page_id}/posts`,
        {
          params: {
            fields,
            access_token: page_access_token,
          },
        }
      );
  
      console.log("Page Posts:", response.data);
      res.status(200).json(response.data);
    } catch (error:any) {
        console.log(error.message)
        res.status(500).json({ error: "Failed to fetch page posts" });
    }
  };

  export async function getReels(req:any, res:any){
    const { page_id, page_access_token } = req.query;
    if(!page_id || !page_access_token){
        return res.status(400).json({ error: "Page ID and Access Token are required." });
    }
    try{
        const response = await axios.get(`https://graph.facebook.com/v22.0/${page_id}/video_reels`,{
            params:{
                access_token: page_access_token,
                fields: "id,media_type,thumbnail_url,permalink,status"
            }
        })
        res.status(200).json(response.data)
    }
    catch(error:any){
        console.log(error.message)
        res.status(500).json({
            error: error.response ? error.response.data : "Internal Server Error",
        });
    }
  }
  
  export async function getPageEvents(req: any, res: any) {
    try {
      const { page_id, page_access_token } = req.query;
  
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${page_id}/events`,
        {
          params: {
            access_token: page_access_token,
            fields: "id,name,description,start_time,end_time,place,cover",
          },
        }
      );
  
      res.json({ success: true, events: response.data.data });
    } catch (error:any) {
      console.error("Error fetching page events:", error.response?.data || error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  }

  export async function getPostInsights(req:any, res:any){
    const {post_id, page_access_token, page_id} = req.query;
    if(!post_id){
        return res.status(400).json({ error: "Post ID is required." });
    }
    try{
        const response = await axios.get(`https://graph.facebook.com/v22.0/${post_id}/insights`,{
            params:{
                access_token: page_access_token,
                metric:[
                    'post_impressions',
                    'post_clicks',
                    'post_engagements',
                    'post_video_avg_time_watched',
                ].join(","),
            }
        })

        res.status(200).json(response.data)
    }
    catch(error:any){
        console.log(error.message)
        res.status(500).json({
            error: error.response ? error.response.data : "Internal Server Error",
        });
    }
  }

  export async function deletePost(req:any, res:any){
    const {post_id, page_access_token} = req.query;
    if(!post_id || !page_access_token){
        return res.status(400).json({ error: "Post ID and Access Token are required." });
    }
    try{
        const response = await axios.delete(`https://graph.facebook.com/v22.0/${post_id}`,{
            params:{
                access_token: page_access_token,
            }
        })
        res.status(200).json(response.data)
    }
    catch(error:any){
        console.log(error.message)
        res.status(500).json({
            error: error.response ? error.response.data : "Internal Server Error",
        });
    }
  }

