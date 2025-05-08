import axios from "axios";
import { Request, Response } from "express";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();
export async function generateHashtags(req: Request, res: Response) {
  const { keyword, limit } = req.body;

  if (!keyword) {
    res.status(400).json({ error: "Keyword is required" });
    return;
  }

  const options = {
    method: "GET",
    url: "https://instagram-hashtags.p.rapidapi.com/",
    params: { keyword: keyword },
    headers: {
      "x-rapidapi-key": process.env.INSTAGRAM_STATS_API_KEY,
      "x-rapidapi-host": "instagram-hashtags.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    const result = response.data.map((hashtag: any) => {
      return {
        hashtag: hashtag.keyword,
        posts: hashtag.post_last_hr,
      };
    });

    if (limit) {
      res.status(200).json(result.slice(0, limit));
      return;
    }
    res.status(200).json(result);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch hashtags" });
  }
}

const groq = new Groq({
  apiKey: "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",
});

export async function generateHashtagsFromImage(req: Request, res: Response) {
  const { image_url, limit } = req.body;
  if (!image_url) {
    res.status(400).json({ error: "Image URL is required" });
    return;
  }
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are given an image. Your task is to analyze its visual content and return one single lowercase keyword that best captures the primary subject or dominant concept of the image.\n\nThis concept may be:\n\nA concrete object (e.g., car, dog, building)\n\nA natural scene or environment (e.g., forest, beach, sky)\n\nA living being (e.g., cat, person, bird)\n\nA human activity or event (e.g., cooking, dancing, meeting)\n\nA place or setting (e.g., kitchen, city, mountain)\n\nOr any other singular idea that clearly defines what the image is mostly about.\n\n✅ Rules\nReturn exactly one keyword.\n\nThe keyword must be lowercase.\n\nDo not include any punctuation, extra words, or explanation.\n\nFocus only on what is most visually dominant or semantically central.\n\nIf the image is abstract, return the best-fitting abstract concept (e.g., pattern, texture, light).",
            },
            {
              type: "image_url",
              image_url: {
                url: `${image_url}`,
              },
            },
          ],
        },
        {
          role: "assistant",
          content: "code",
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 1,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false,
      stop: null,
    });
    const output = chatCompletion.choices[0].message.content;
    const keyword = output?.replace(":", "").trim();
    const options = {
      method: "GET",
      url: "https://instagram-hashtags.p.rapidapi.com/",
      params: { keyword: keyword },
      headers: {
        "x-rapidapi-key": process.env.INSTAGRAM_STATS_API_KEY,
        "x-rapidapi-host": "instagram-hashtags.p.rapidapi.com",
      },
    };

    const response = await axios.request(options);
    const result = response.data.map((hashtag: any) => {
      return {
        hashtag: hashtag.keyword,
        posts: hashtag.post_last_hr,
      };
    });
    if (limit) {
      res.status(200).json(result.slice(0, limit));
      return;
    }
    res.status(200).json(result);
    return;
  } catch (error) {
    console.error("Error generating hashtags from image:", error);
    // res.status(500).json({error:"Failed to generate hashtags from image"})
  }
}
