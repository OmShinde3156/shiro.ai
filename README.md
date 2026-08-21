# Shiro.ai

> The Neon Curator - Transform your long study documents into an engaging, multi-episode podcast and active learning session.

<div align="center">
  <a href="images/image.png">
    <img src="images/thumbs/image.png" alt="Shiro.ai Landing Page" width="600"/>
  </a>
</div>

## Description

Shiro.ai is an advanced, AI-powered study companion designed to transform any learning material into interactive, engaging, and dynamic study sessions. 
It solves the problem of passive reading by automatically generating study aids like quizzes, flashcards, mind maps, and full audio podcasts from any uploaded document (PDF, Text, YouTube). 
It is built for students, researchers, and professionals who want to maximize their learning efficiency and retention.

## Demo / Screenshots

*Click on any thumbnail to view the full resolution image!*

| Feature | Preview |
| :--- | :--- |
| **Dashboard / Home** | <a href="images/image copy.png"><img src="images/thumbs/image copy.png" width="300" /></a> |
| **My Library** | <a href="images/image copy 2.png"><img src="images/thumbs/image copy 2.png" width="300" /></a> |
| **Document Details & Chat** | <a href="images/image copy 9.png"><img src="images/thumbs/image copy 9.png" width="300" /></a> |
| **Study Tools & Flashcards** | <a href="images/image copy 3.png"><img src="images/thumbs/image copy 3.png" width="300" /></a> |
| **Starfish Mind Maps** | <a href="images/image copy 4.png"><img src="images/thumbs/image copy 4.png" width="300" /></a> |
| **Quiz System** | <a href="images/image copy 5.png"><img src="images/thumbs/image copy 5.png" width="300" /></a> |
| **Learning Analytics** | <a href="images/image copy 6.png"><img src="images/thumbs/image copy 6.png" width="300" /></a> |
| **Audio Podcasts** | <a href="images/image copy 7.png"><img src="images/thumbs/image copy 7.png" width="300" /></a> |
| **Feynman Room** | <a href="images/image copy 8.png"><img src="images/thumbs/image copy 8.png" width="300" /></a> |

## Features

- **Document Processing**: Upload PDFs, notes, or YouTube videos to extract knowledge.
- **Starfish Mind Maps**: Visually explore interconnected concepts generated directly from your documents.
- **Podcast Generation**: Turn long documents into engaging, multi-episode audio study sessions using AI TTS.
- **Feynman Room**: Test your understanding by teaching concepts back to the AI.
- **Smart Flashcards & Quizzes**: Automatically generated active recall tools to test memory.
- **RAG Chat Assistant (Shiro)**: Chat directly with your documents for deep dive explanations.
- **Progress Tracking**: Analytics dashboard to track your study sessions and mastery.

## Tech Stack

- **Frontend**: React.js · Vite · Tailwind CSS
- **Backend**: Python 3.11 · FastAPI · Celery
- **Database**: SQLite · SQLAlchemy
- **Vector Store**: ChromaDB
- **AI Models**: Google Gemini API · Google Text-to-Speech

## Prerequisites

- Node.js 20+
- Python 3.11+
- A Google Gemini API Key

## Installation / Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/OmShinde3156/shiro.ai.git
   cd shiro.ai
   ```

2. **Backend Setup**
   ```bash
   cd Backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd ../buscul
   npm install
   ```

## Environment Variables

In the `Backend` directory, create a `.env` file based on the required secrets.
*(Note: Never commit your actual `.env` file to version control)*

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Usage

**1. Start the Backend Server**
```bash
cd Backend
python main.py
```
*(Runs on `http://localhost:8000`)*

**2. Start the Background Worker (For Podcasts & Heavy Processing)**
In a separate terminal within the `Backend` directory:
```bash
celery -A celery_app worker --loglevel=info -P gevent
```

**3. Start the Frontend Development Server**
In a separate terminal within the `buscul` directory:
```bash
npm run dev
```
*(Runs on `http://localhost:5173`)*

## Project Structure

```
shiro.ai/
├── Backend/               # FastAPI Python backend
│   ├── routers/           # API Endpoints (features, auth, rooms, etc.)
│   ├── services/          # Core business logic (RAG, Podcasts, MindMaps)
│   ├── database/          # SQLite & ChromaDB setup
│   ├── static/            # Generated audio podcasts
│   └── main.py            # FastAPI application entry point
├── buscul/                # React Vite frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components & Pages
│   │   ├── context/       # React Context (Auth, Theme, Podcasts)
│   │   ├── index.css      # Tailwind & Global styles
│   │   └── App.jsx        # Routing configuration
├── images/                # Screenshots and UI assets
└── README.md              # Project documentation
```

## API Documentation

Once the backend is running, FastAPI automatically generates interactive API documentation. You can explore and test all endpoints via Swagger UI at:
`http://localhost:8000/docs`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Author / Contact

- GitHub: [@OmShinde3156](https://github.com/OmShinde3156)

## Status / Roadmap

- [x] RAG Document Chat
- [x] Automated Flashcards & Quizzes
- [x] Feynman Learning Room
- [x] Multi-episode Podcast Generation
- [x] Starfish Mind Maps
- [ ] Multi-user Study Rooms (In Progress)
- [ ] Export features (PDF/Anki)
