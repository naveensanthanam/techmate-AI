# 🤖 TechDoc 3.0 - Universal AI Technical Support Assistant

Your universal AI technical support assistant powered by Google's Gemini API. Get instant expert help for any technology problem.

## 📋 Project Overview

- **Frontend**: HTML, CSS, JavaScript (Single Page Application)
- **Backend**: Node.js + Express.js
- **AI Engine**: Google Gemini API
- **Storage**: Browser LocalStorage for chat sessions
- **Deployment**: Ready for Render, Vercel, Heroku, or any Node.js hosting

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- Free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Setup
1. **Clone/Download the project**
   ```bash
   cd "Techdoc 3.0"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key** (Choose one):
   - Create `.env` file:
     ```env
     GEMINI_API_KEY=your_api_key_here
     PORT=8080
     ```
   - OR enter via web UI modal on first load

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:8080
   ```

## 📦 Deployment to Render

### Step-by-Step Guide

1. **Push to GitHub**
   - Create a GitHub repository
   - Push this code to the repo

2. **Create Render Service**
   - Go to [render.com](https://render.com)
   - Sign up / Log in
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml` configuration

3. **Set Environment Variables**
   - In Render dashboard, go to "Environment"
   - Add these variables:
     ```
     GEMINI_API_KEY = your_api_key_here
     NODE_ENV = production
     ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (2-3 minutes)
   - Your app will be live at: `https://your-app-name.onrender.com`

## 📁 File Structure

```
Techdoc 3.0/
├── server.js           # Express.js server (entry point)
├── app.js              # Frontend JavaScript logic
├── index.html          # Main HTML file
├── styles.css          # Styling
├── package.json        # Node.js dependencies
├── render.yaml         # Render deployment config
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
└── start.bat           # Windows start script (legacy)
```

## 🔑 Getting a Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Select or create a Google Cloud project
4. Copy your API key
5. Store it securely in `.env` or as an environment variable

## 🛠 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start in development mode |

## 🌐 Deployment Options

### Render (Recommended - Free Tier Available)
- Automatic deployment from GitHub
- Free tier includes 750 hours/month
- Config: `render.yaml` (already included)

### Other Platforms

**Vercel** - Frontend hosting
```bash
vercel deploy
```

**Heroku** - (Legacy, but still works)
```bash
git push heroku main
```

**Railway** - Simple deployment
- Connect GitHub repo at [railway.app](https://railway.app)

**AWS/Azure** - Enterprise options
- Use Docker or Lambda

## 📝 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google Gemini API Key |
| `PORT` | No | 8080 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |

## 🔒 Security Notes

- **Never commit `.env` files** - Already in `.gitignore`
- **API keys in Render** - Stored securely as environment variables
- **Client-side API usage** - Gemini API is called directly from browser (standard practice)
- **Local storage** - Chat history stored only in browser, never on server

## 🚀 Performance

- Lightweight frontend (~50KB)
- Fast Express.js backend
- Stateless architecture (scales horizontally)
- Free Render tier suitable for small to medium traffic

## 🐛 Troubleshooting

### "API Key is invalid"
- Verify the key is correct in `.env` or Render environment
- Check key hasn't expired in Google Cloud Console

### "Port already in use"
- Change PORT in `.env` or run on different port: `PORT=3000 npm start`

### "Static files not found"
- Ensure `index.html`, `app.js`, `styles.css` are in the same directory as `server.js`

## 📚 Features

✅ AI-powered technical support for all tech topics  
✅ Multi-language support (English, Tamil, Tanglish)  
✅ Multiple Gemini AI models available  
✅ Chat session management  
✅ Dark mode interface  
✅ Copy responses  
✅ Responsive design (mobile-friendly)  
✅ No database required (LocalStorage-based)  

## 📄 License

MIT License - Feel free to modify and deploy!

## 👨‍💻 Support

For issues or questions:
- Check GitHub Issues in the repository
- Review error messages in browser console (F12)
- Verify Render deployment logs in dashboard

---

**Deploy now:** Push to GitHub → Connect to Render → Done! 🎉
