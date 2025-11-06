import axios from "axios";

export type Source = { title: string; url: string; content: string };

export async function webSearch(query: string): Promise<Source[]> {
  const resp = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: process.env.TAVILY_API_KEY,
      query,
      include_domains: [],
      max_results: 5,
      search_depth: "advanced",
      include_answer: false,
      include_images: false,
      include_raw_content: false
    },
    { timeout: 20000 }
  );

  const results = resp.data.results || [];
  return results.slice(0, 5).map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.snippet || r.content || ""
  }));
}
