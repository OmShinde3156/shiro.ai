# Shiro.ai - The Neon Curator

<div align="center">
  <a href="images/image.png">
    <img src="images/thumbs/image.png" alt="Shiro.ai Landing Page" width="600"/>
  </a>
</div>

Shiro.ai is an advanced, AI-powered study companion designed to transform any learning material into interactive, engaging, and dynamic study sessions. With a sleek dark-mode UI inspired by modern aesthetics, Shiro bridges the gap between passive reading and active recall.

## 🚀 Key Features

*Click on any thumbnail to view the full resolution image!*

| Feature | Preview |
| :--- | :--- |
| **Landing Page** | <a href="images/image.png"><img src="images/thumbs/image.png" width="300" /></a> |
| **Dashboard / Home** | <a href="images/image copy.png"><img src="images/thumbs/image copy.png" width="300" /></a> |
| **My Library** | <a href="images/image copy 2.png"><img src="images/thumbs/image copy 2.png" width="300" /></a> |
| **Document Details & Chat** | <a href="images/image copy 9.png"><img src="images/thumbs/image copy 9.png" width="300" /></a> |
| **Study Tools & Flashcards** | <a href="images/image copy 3.png"><img src="images/thumbs/image copy 3.png" width="300" /></a> |
| **Starfish Mind Maps** | <a href="images/image copy 4.png"><img src="images/thumbs/image copy 4.png" width="300" /></a> |
| **Quiz System** | <a href="images/image copy 5.png"><img src="images/thumbs/image copy 5.png" width="300" /></a> |
| **Learning Analytics** | <a href="images/image copy 6.png"><img src="images/thumbs/image copy 6.png" width="300" /></a> |
| **Audio Podcasts** | <a href="images/image copy 7.png"><img src="images/thumbs/image copy 7.png" width="300" /></a> |
| **Feynman Room** | <a href="images/image copy 8.png"><img src="images/thumbs/image copy 8.png" width="300" /></a> |

## 🛠️ Tech Stack

**Frontend:**
- React (Vite)
- Tailwind CSS (Custom Dark Neon Theme)
- Context API for State Management

**Backend:**
- FastAPI
- Python 3.11
- SQLAlchemy + SQLite (Local Database)
- Celery (Background Task Processing)

**AI & Models:**
- Google Gemini API (Core LLM & Chat)
- Google Text-to-Speech (TTS for Podcasts)
- ChromaDB (Local Vector Store for RAG)

## ⚡ Getting Started

### Prerequisites
- Python 3.11+
- Node.js & npm
- A Google Gemini API Key

### Installation

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
   
   # Create a .env file and add your GEMINI_API_KEY
   echo "GEMINI_API_KEY=your_api_key_here" > .env
   
   # Start the FastAPI server
   python main.py
   ```

3. **Frontend Setup**
   ```bash
   cd ../buscul
   npm install
   npm run dev
   ```

4. **Background Tasks (Optional for Podcasts)**
   In a separate terminal within the `Backend` directory:
   ```bash
   celery -A celery_app worker --loglevel=info -P gevent
   ```
