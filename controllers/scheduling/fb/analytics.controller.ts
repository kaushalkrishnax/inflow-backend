import axios, { AxiosResponse } from 'axios';

/**
 * Controller to fetch comprehensive Facebook Page insights
 * @param req - Express request object
 * @param res - Express response object
 */
const getPageInsights = async (req: any, res: any): Promise<void> => {
  try {
    const { page_id, page_access_token, date_preset='this_month' } = req.query;

    const finalResponse: Record<string,any> = {};
    
    // Validate required parameters
    if (!page_id || !page_access_token) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: page_id and page_access_token are required'
      });
      return;
    }

    // Base URL for Graph API
    const baseUrl = 'https://graph.facebook.com/v22.0';
    
    // 1. Fetch basic page information
    const pageInfo: AxiosResponse<{}> = await axios.get(`${baseUrl}/${page_id}`, {
      params: {
        access_token: page_access_token,
        fields: 'id,name,about,category,category_list,fan_count,followers_count,talking_about_count,link,website,phone,location'
      }
    });

    finalResponse['page_info'] = pageInfo.data;
    // 2. Fetch page insights with multiple metrics
    
    const ctaClicks: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
      params: {
        access_token: page_access_token,
        metric: [
          'page_total_actions',
        ].join(','),
        date_preset
      }
    }).catch(() => ({ data: { data: null } } as any));

    finalResponse['cta_clicks'] = ctaClicks.data.data;

    // 3. Fetch audience demographics
    const postEngagements: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
      params: {
        access_token: page_access_token,
        metric: [
          'page_post_engagements',
          'page_fan_adds_by_paid_non_paid_unique',
          'page_daily_follows',
          'page_daily_follows_unique',
          'page_daily_unfollows_unique',
          'page_follows'
        ].join(','),
        date_preset
      }
    }).catch(() => ({ data: { data: null } } as any));

    finalResponse['post_engagements'] = postEngagements.data.data;
    // 4. Fetch recent posts
    const pageImpressions: AxiosResponse<{data:any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
      params: {
        access_token: page_access_token,
        metric: [
            'page_impressions',
            'page_impressions_unique',
            'page_impressions_paid',
            'page_impressions_paid_unique',
            'page_impressions_viral',
            'page_impressions_nonviral'
        ].join(","),
        date_preset

      }
    }).catch(() => ({ data: { data: null } } as any));
    finalResponse['page_impressions'] = pageImpressions.data.data;


        const postClicks: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
      params: {
        access_token: page_access_token,
        metric: [
            'post_clicks',
            'post_clicks_by_type'
        ].join(','),
        date_preset

      }
    }).catch(() => ({ data: { data: null } } as any)); 

    finalResponse['post_clicks'] = postClicks.data.data;
    


    const postImpressions: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric: [
                'post_impressions',
                'post_impressions_unique',
                'post_impressions_paid',
                'post_impressions_organic',
                'post_impressions_fan',
                'post_impressions_viral',
                'post_impressions_nonviral'
            ].join(","),
            date_preset
            }
        }).catch(() => ({ data: { data: null } } as any));
    

        finalResponse['post_impressions'] = postImpressions.data.data;
    const reactions: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric: [
                'page_actions_post_reactions_like_total',
                'page_actions_post_reactions_love_total',
                'page_actions_post_reactions_wow_total',
                'page_actions_post_reactions_haha_total',
                'page_actions_post_reactions_sorry_total',
                'page_actions_post_reactions_anger_total'
            ].join(","),
        date_preset

        }
    }).catch(() => ({ data: { data: null } } as any));

    finalResponse['reactions'] = reactions.data.data;
    const fans: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric: [
                'page_fans',
                'page_fans_locale',
                'page_fans_city',
                'page_fans_country'
            ].join(","),
        date_preset

        }
    }).catch(() => ({ data: { data: null } } as any));
    finalResponse['fans'] = fans.data.data;

    const videoViews: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric: [
                'page_video_views',
                'page_video_views_autoplayed',
                'page_video_repeat_views',
                'page_video_complete_views_30s'
            ].join(","),
        date_preset

        }
    }).catch(() => ({ data: { data: null } } as any));

    finalResponse['video_views'] = videoViews.data.data;

    const pageViews: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric: [
                'page_views_total',
            ].join(","),
        date_preset

        }
    }).catch(() => ({ data: { data: null } } as any));

    finalResponse['page_views'] = pageViews.data.data;

    const pagePostVideos: AxiosResponse<{data: any}> = await axios.get(`${baseUrl}/${page_id}/insights`, {
        params: {
            access_token: page_access_token,
            metric:[
                'post_video_avg_time_watched',
                'post_video_complete_views_organic',
                'post_video_complete_views_paid',
                'post_video_retention_graph',
                'post_video_views',
                'post_activity_by_action_type'
            ].join(","),
        date_preset

        }
    }).catch(() => ({ data: { data: null } } as any));
    
    finalResponse['page_post_videos'] = pagePostVideos.data.data;


    res.status(200).json({
      data:{...finalResponse}
    });
    
  } catch (error: any) {
    // console.error('Error fetching page insights:', error);
    
    // Handle Graph API specific errors
    if (error.response && error.response.data && error.response.data.error) {
      res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data.error
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while fetching page insights'
    });
  }
};

export {
  getPageInsights
};