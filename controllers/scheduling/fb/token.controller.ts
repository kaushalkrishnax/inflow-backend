import axios from 'axios';
import dontenv from 'dotenv';
import { facebook_permissions } from '../../../utils/permissions';

dontenv.config();


export async function generateLongLivedToken(req: any, res: any) {
        
        const {exchange_code} = req.body
        
        const app_id = process.env.META_APP_ID;
        const client_secret = process.env.META_APP_SECRET;
        const redirect_uri = process.env.META_REDIRECT_URI;

        if (!app_id || !redirect_uri || !client_secret || !exchange_code) {
            return res.status(400).json({ error: "All parameters are required." });
        }

        try{
        const short_token = await axios.get("https://graph.facebook.com/v22.0/oauth/access_token", {
            params: {
              client_id: app_id,
              client_secret: client_secret,
              redirect_uri: redirect_uri,
              code: exchange_code,
        },
        })
        
        const response = await axios.get("https://graph.facebook.com/v22.0/oauth/access_token", {
            params: {
              grant_type: "fb_exchange_token",
              client_id: app_id,
              client_secret: client_secret,
              fb_exchange_token: short_token.data.access_token,
            },
        });
        res.status(200).json(response.data)
    }
        catch (error: any) {
        console.log(error.message)
        res.status(500).json({
            error: error.response ? error.response.data : "Internal Server Error",
        });
    }
}

const FACEBOOK_AUTHORIZATION_URL = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&scope=${facebook_permissions.join(",")}`

export async function getFacebookAuthorizationUrl(req:any, res:any){
    res.status(200).json({data:FACEBOOK_AUTHORIZATION_URL})
}

