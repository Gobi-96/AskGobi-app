# AskGobi – Perplexity-style Q&A (MVP)

Public Q&A engine with web search (Tavily) + free LLM (Groq Llama 3.1). Dark theme by default with toggle.

## 1) Prereqs
- Node 18+
- API keys:
  - **Groq**: https://console.groq.com/keys
  - **Tavily**: https://tavily.com

## 2) Setup
```bash
cp .env.local.example .env.local
# put your keys in .env.local
npm install
npm run dev
```

Open http://localhost:3000

## 3) Deploy (Vercel)
- Push to GitHub
- Import repo on https://vercel.com
- Add env vars: `GROQ_API_KEY`, `TAVILY_API_KEY`
- Deploy 🎉

## Notes
- Model: `llama-3.1-70b-versatile` via Groq SDK.
- Search: Tavily free tier (with citations).
- No login/history now. Ready to add Supabase + NextAuth later.
