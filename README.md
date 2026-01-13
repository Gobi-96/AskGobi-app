# AskGobi – Local Q&A (MVP)

Local-first Q&A engine powered by Ollama, with optional online lookup. Dark theme by default with toggle.

## 1) Prereqs
- Node 18+
- Ollama (local models)

## 2) Setup (macOS)
1) Install Ollama:
```bash
brew install ollama
```

2) Start the Ollama server (leave this running):
```bash
ollama serve
```

3) Download a small model (recommended for M1/M2):
```bash
ollama pull phi3:mini
```

4) Install app dependencies and configure env:
```bash
cp .env.local.example .env.local
npm install
```

5) Edit `.env.local`:
```
OLLAMA_MODEL=phi3:mini
OLLAMA_PORTS=11434
```

6) Start the app:
```bash
npm run dev -- -p 3000
```

Open http://localhost:3000 (or change the port if 3000 is in use).

## 3) Setup (Windows)
1) Install Ollama from https://ollama.com/download

2) Start the Ollama server:
```powershell
ollama serve
```

3) Download a small model:
```powershell
ollama pull phi3:mini
```

4) Install app dependencies and configure env:
```powershell
copy .env.local.example .env.local
npm install
```

5) Edit `.env.local`:
```
OLLAMA_MODEL=phi3:mini
OLLAMA_PORTS=11434
```

6) Start the app:
```powershell
npm run dev -- -p 3000
```

Open http://localhost:3000.

## Notes
- Local models are configured via `OLLAMA_MODEL` and `OLLAMA_PORTS`.
- Suggested models:
  - `phi3:mini` (small, good for laptops)
  - `llama3.2:3b` (small, stronger but heavier)
  - `qwen2.5:0.5b` (tiny, fastest, weakest)
- If port 3000 is in use, run `npm run dev -- -p 3001`.

## Troubleshooting
- Missing dependencies after a fresh install:
  - `npm install rehype-raw p-limit`
- Next.js cache errors (`invalid code lengths set`):
  - `rm -rf .next`

## App Screenshots

<img width="1342" height="732" alt="image" src="https://github.com/user-attachments/assets/ddd7ab01-b2bf-4393-8bb8-5a3a2beec264" />

<img width="1341" height="727" alt="image" src="https://github.com/user-attachments/assets/cc70fc4f-5c7f-4aba-b911-b78ee03f66be" />

<img width="2204" height="1148" alt="image" src="https://github.com/user-attachments/assets/3766a6e2-4b8e-4549-b257-0f177682bf60" />

<img width="2208" height="1090" alt="image" src="https://github.com/user-attachments/assets/53245bef-0e20-4336-ae3d-8beccd0209f1" />

<img width="1419" height="695" alt="image" src="https://github.com/user-attachments/assets/78358f46-25ca-433a-943e-71787d21c532" />


