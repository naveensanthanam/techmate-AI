/* ================================================================
   TechDoc 3.0 — AI Chat Engine
   Gemini API Integration | Full Chat System
================================================================ */

'use strict';

// ================================================================
// STATE
// ================================================================
const State = {
    apiKey: 'AQ.Ab8RN6LStXJ8bDfOR43bK-qM29ZOAqVgXb1uA4tT7RDkSxGwwQ', // <-- PASTE YOUR KEY HERE
    model: 'gemini-2.5-flash',
    sessions: [],          // all chat sessions
    currentSessionId: null,
    isStreaming: false,
    theme: 'dark',
    attemptCount: 0,       // tracks how many solutions tried for current problem
    lastProblem: '',       // last problem message for retry logic
    previousSolutions: [], // to avoid repeating solutions on "No"
};

// ================================================================
// DOM REFS
// ================================================================
// DOM refs — populated inside init() after DOMContentLoaded
const $ = id => document.getElementById(id);
let DOM = {};

// ================================================================
// GEMINI SYSTEM PROMPT
// ================================================================
function buildSystemPrompt() {
    return `You are TechDoc, a Universal AI Technical Support Assistant. You are an experienced Senior Technical Support Engineer with deep expertise in all areas of technology.

YOUR PERSONALITY:
- Friendly, professional, human-like, calm, helpful, intelligent, and supportive
- Never sound robotic or overly formal
- Explain complex concepts in simple, easy-to-understand words
- Be empathetic and patient with users who are frustrated

YOUR SCOPE:
You ONLY help with technology-related topics including:
Hardware: Computers, Laptops, Desktops, Smartphones, Tablets, Printers, Monitors, Keyboards, Mouse, Webcams, Headphones, Smart TVs, Gaming Consoles, IoT Devices, Smart Watches, Routers, Modems, USB devices, HDMI, SSD, HDD, RAM, CPU, GPU, Motherboard, BIOS, Bluetooth, Wi-Fi
Software & OS: Windows, macOS, Linux, Android, iOS/iPadOS, Drivers, BIOS/UEFI settings
Programming: Python, Java, C, C++, JavaScript, TypeScript, React, Angular, Vue, Node.js, Spring Boot, .NET, PHP, Ruby, Go, Rust, Swift, Kotlin
Databases: SQL, MySQL, PostgreSQL, MongoDB, Firebase, Supabase, Redis, SQLite
Cloud & DevOps: AWS, Azure, Google Cloud, Docker, Kubernetes, CI/CD, Git, GitHub, GitLab
Tools & IDEs: VS Code, IntelliJ IDEA, Android Studio, Eclipse, Postman, Figma
AI Tools: ChatGPT, Gemini, Claude, Cursor AI, Microsoft Copilot
Cybersecurity: Ethical Hacking, Penetration Testing, Network Security, Antivirus, Malware removal
Networking: TCP/IP, DNS, VPN, Firewalls, Network troubleshooting
Electronics, Blockchain, Robotics, and all other technology topics

IF USER ASKS NON-TECH QUESTION:
If the user is just saying a friendly greeting (like "hello", "hi", "what is your name", "how are you") or expressing gratitude (like "thank you", "thanks", "super", "awesome"), reply naturally and warmly in the same language. For example, if they say "what is your name", introduce yourself as TechDoc. If they say "thank you", say "You're welcome! Come again if you have more tech issues."
However, if they ask a non-tech question that is completely unrelated to technology (like "what is the capital of France", "give me a recipe"), ONLY then reply with: "I'm TechDoc, your AI Technical Support Assistant. I specialize exclusively in technology-related questions and troubleshooting. Please ask me anything tech-related and I'll be happy to help! 😊"

LANGUAGE RULES (VERY IMPORTANT):
- Detect the language the user is writing in
- If user writes in English → reply in English only
- If user writes in Tamil (தமிழ்) → reply in Tamil only  
- If user writes in Tanglish (Tamil words written in English letters, e.g., "laptop slow a iruku", "wifi connect aagala") → reply in Tanglish naturally
- If user mixes languages → reply in the same mixed style
- NEVER force English if user is not writing in English
- Match the user's communication style exactly

RESPONSE FORMAT:
For technical problems, always structure your response using these sections:

🔍 **Problem Analysis**
[Briefly explain the problem in simple terms]

❓ **Possible Causes**
[List likely causes using phrases like "Based on your description...", "The most likely cause...", "This could happen because..."]

✅ **Step-by-Step Solution**
[Numbered steps, clear and actionable]

⚠️ **Important Notes**
[Warnings, precautions, or additional tips if relevant]

---
*Did this solution help you? Let me know if it worked or if you need a different approach!*

RETRY BEHAVIOR (when user says previous solution didn't work):
- DO NOT repeat the previous solution
- Analyze the problem from a completely different angle
- Provide a different troubleshooting approach
- Keep track that this is attempt #${State.attemptCount > 0 ? State.attemptCount + 1 : 1}
- Only suggest contacting a technician after exhausting all common troubleshooting methods

SUCCESS BEHAVIOR (when user says solution worked):
Provide:
✔️ **Why This Happened** — explain the root cause
🛡️ **Prevention Tips** — how to avoid this in the future
⭐ **Best Practices** — related good practices
📊 **Severity Level** — Low/Medium/High/Critical
💡 **Additional Suggestions** — any extra tips

Previous solutions already tried (do NOT repeat these): ${State.previousSolutions.length > 0 ? State.previousSolutions.map((s, i) => `Attempt ${i + 1}: ${s}`).join('; ') : 'None'}`;
}

// ================================================================
// SESSION MANAGEMENT
// ================================================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createNewSession() {
    const session = {
        id: generateId(),
        title: 'New Chat',
        messages: [],       // { role: 'user'|'model', text: string, timestamp: number }
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    State.sessions.unshift(session);
    State.currentSessionId = session.id;
    State.attemptCount = 0;
    State.previousSolutions = [];
    State.lastProblem = '';
    saveSessions();
    renderHistory();
    return session;
}

function getCurrentSession() {
    return State.sessions.find(s => s.id === State.currentSessionId);
}

function saveSessions() {
    // Only save last 30 sessions, trim messages to save space
    const toSave = State.sessions.slice(0, 30).map(s => ({
        ...s,
        messages: s.messages.slice(-60), // keep last 60 messages per session
    }));
    try { localStorage.setItem('techdoc_sessions', JSON.stringify(toSave)); } catch (e) { }
}

function loadSessions() {
    try {
        const raw = localStorage.getItem('techdoc_sessions');
        if (raw) State.sessions = JSON.parse(raw);
    } catch (e) { State.sessions = []; }
}

function deleteSession(id, e) {
    e.stopPropagation();
    State.sessions = State.sessions.filter(s => s.id !== id);
    saveSessions();
    if (State.currentSessionId === id) {
        if (State.sessions.length > 0) {
            loadSession(State.sessions[0].id);
        } else {
            State.currentSessionId = null;
            showWelcome();
        }
    }
    renderHistory();
}

function loadSession(id) {
    const session = State.sessions.find(s => s.id === id);
    if (!session) return;
    State.currentSessionId = id;
    State.attemptCount = 0;
    State.previousSolutions = [];
    State.lastProblem = '';
    renderHistory();
    renderSessionMessages(session);
    closeSidebarMobile();
}

function renderHistory() {
    const list = DOM.historyList;
    // Clear all items (preserve empty message if needed)
    list.innerHTML = '';

    if (State.sessions.length === 0) {
        list.innerHTML = '<div class="history-empty" id="history-empty">No previous chats</div>';
        return;
    }

    State.sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item' + (session.id === State.currentSessionId ? ' active' : '');
        item.innerHTML = `
            <span class="history-item-icon">💬</span>
            <span class="history-item-text" title="${escHtml(session.title)}">${escHtml(session.title)}</span>
            <button class="history-item-delete" title="Delete" onclick="deleteSession('${session.id}', event)">✕</button>
        `;
        item.addEventListener('click', () => loadSession(session.id));
        list.appendChild(item);
    });
}

// ================================================================
// RENDER MESSAGES
// ================================================================
function showWelcome() {
    DOM.welcomeScreen.style.display = 'flex';
    DOM.messagesContainer.innerHTML = '';
    DOM.messagesContainer.style.display = 'none';
}

function hideWelcome() {
    DOM.welcomeScreen.style.display = 'none';
    DOM.messagesContainer.style.display = 'flex';
}

function renderSessionMessages(session) {
    DOM.messagesContainer.innerHTML = '';
    if (session.messages.length === 0) {
        showWelcome();
        return;
    }
    hideWelcome();
    session.messages.forEach(msg => {
        appendMessageBubble(msg.role, msg.text, false);
    });
    scrollToBottom(true);
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── FORMAT AI TEXT ── 
// Converts markdown-like syntax into HTML for display
function formatAIText(text) {
    let html = text;

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${escHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Section headers with emojis (🔍 **Title**)
    html = html.replace(/^([🔍❓✅⚠️⚠✔️✔🛡️🛡⭐💡📊🔥💻📱🎯])\s*\*\*(.+?)\*\*/gm,
        '<div class="section-head">$1 $2</div>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Numbered lists (1. 2. 3.)
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, (_, num, content) => {
        return `<div class="step-item"><span class="step-num">${num}</span><span>${content}</span></div>`;
    });

    // Bullet lists
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Warning notes (⚠️ lines)
    html = html.replace(/<div class="section-head">⚠[️]? (.+?)<\/div>([\s\S]*?)(?=<div class="section-head">|$)/g,
        (match, title, body) => {
            return `<div class="section-head">⚠️ ${title}</div><div class="warning-note">${body.trim()}</div>`;
        });

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">');

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already
    if (!html.startsWith('<')) html = '<p>' + html + '</p>';

    return html;
}

function appendMessageBubble(role, text, animate = true) {
    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

    const avatarHtml = role === 'user'
        ? `<div class="msg-avatar user-avatar">You</div>`
        : `<div class="msg-avatar ai-avatar">🤖</div>`;

    const senderName = role === 'user' ? 'You' : 'TechDoc AI';
    const bubbleId = 'bubble-' + generateId();

    let actionsHtml = '';
    if (role === 'model') {
        actionsHtml = `
        <div class="msg-actions">
            <button class="msg-action-btn" onclick="copyMessage('${bubbleId}', this)" title="Copy response">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
            </button>
        </div>`;
    }

    row.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            <div class="msg-sender">${senderName}</div>
            <div class="msg-bubble" id="${bubbleId}">
                ${role === 'user' ? escHtml(text) : formatAIText(text)}
            </div>
            ${actionsHtml}
        </div>
    `;

    if (!animate) row.style.animation = 'none';
    DOM.messagesContainer.appendChild(row);
    return { row, bubbleId };
}

function appendThinkingBubble() {
    const row = document.createElement('div');
    row.className = 'message-row ai-row';
    row.id = 'thinking-row';
    row.innerHTML = `
        <div class="msg-avatar ai-avatar">🤖</div>
        <div class="message-content">
            <div class="msg-sender">TechDoc AI</div>
            <div class="msg-bubble" id="thinking-bubble">
                <div class="thinking-bubble">
                    <span class="thinking-dot"></span>
                    <span class="thinking-dot"></span>
                    <span class="thinking-dot"></span>
                </div>
            </div>
        </div>
    `;
    DOM.messagesContainer.appendChild(row);
    scrollToBottom();
    return row;
}

function removeThinkingBubble() {
    const el = $('thinking-row');
    if (el) el.remove();
}

function appendFeedbackButtons(problemSummary) {
    // Remove any existing feedback
    const existingFb = document.querySelector('.feedback-row');
    if (existingFb) existingFb.remove();
    const existingFq = document.querySelector('.feedback-question');
    if (existingFq) existingFq.remove();

    const question = document.createElement('div');
    question.className = 'feedback-question';
    question.textContent = '💬 Did this solution help resolve your problem?';

    const row = document.createElement('div');
    row.className = 'feedback-row';
    row.id = 'feedback-row';
    row.innerHTML = `
        <button class="feedback-btn yes-btn" onclick="handleFeedback(true, '${escHtml(problemSummary).replace(/'/g, "\\'")}')">
            ✅ Yes, it worked!
        </button>
        <button class="feedback-btn no-btn" onclick="handleFeedback(false, '${escHtml(problemSummary).replace(/'/g, "\\'")}')">
            ❌ No, still broken
        </button>
    `;

    DOM.messagesContainer.appendChild(question);
    DOM.messagesContainer.appendChild(row);
    scrollToBottom();
}

function removeFeedbackButtons() {
    document.querySelectorAll('.feedback-row, .feedback-question').forEach(el => el.remove());
}

// ================================================================
// GEMINI API — STREAMING
// ================================================================
async function callGemini(messages, systemPrompt) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${State.model}:streamGenerateContent?alt=sse&key=${State.apiKey}`;

    // Build conversation history for multi-turn
    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
    }));

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ]
    };

    let response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    // Auto-fallback for Quota Exceeded (429) or model not found
    if (!response.ok && State.model !== 'gemini-1.5-flash') {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || '';
        const status = response.status;

        if (status === 429 || errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('not found')) {
            console.warn(`Model ${State.model} error (${status}), auto-falling back to gemini-1.5-flash`);

            // Rebuild payload (strip system_instruction just in case, inject into contents)
            const fallbackContents = JSON.parse(JSON.stringify(contents)); // deep copy
            if (fallbackContents.length > 0) {
                fallbackContents[0].parts.unshift({ text: "SYSTEM INSTRUCTIONS:\n" + systemPrompt + "\n\n---END INSTRUCTIONS---\n\n" });
            }

            // Fetch available models first
            const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${State.apiKey}`);
            if (!listResponse.ok) throw new Error("Could not fetch model list to fallback.");
            const listData = await listResponse.json();

            // Find a valid model that supports generateContent (prefer 1.5 flash or pro)
            let chosenModel = '';
            for (const m of listData.models) {
                if (m.supportedGenerationMethods.includes('generateContent') || m.supportedGenerationMethods.includes('streamGenerateContent')) {
                    if (m.name.includes('gemini-2.0-flash') || m.name.includes('gemini-1.5-flash') || m.name.includes('gemini-1.5-pro')) {
                        chosenModel = m.name; // e.g. "models/gemini-2.0-flash"
                        break;
                    }
                }
            }
            if (!chosenModel) chosenModel = listData.models.find(m => (m.supportedGenerationMethods.includes('generateContent') || m.supportedGenerationMethods.includes('streamGenerateContent')))?.name;
            if (!chosenModel) throw new Error("No available fallback models found for this API key.");

            // Rebuild payload for v1beta API
            const fallbackBody = {
                contents: fallbackContents,
                generationConfig: body.generationConfig,
                safetySettings: body.safetySettings
            };

            // chosenModel is already prefixed with "models/", e.g. "models/gemini-1.5-flash"
            const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:streamGenerateContent?alt=sse&key=${State.apiKey}`;

            response = await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackBody),
            });

            if (response.ok) {
                showToast('⚡ Switched to Gemini 1.5 Flash (2.5 Quota Exceeded)');
            }
        } else {
            // Re-throw original error if it wasn't a quota/not-found issue
            throw new Error(errMsg || `HTTP ${status}`);
        }
    }

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let msg = errData?.error?.message || `HTTP ${response.status}`;
        
        // Custom override for the user's invalid OAuth key
        if (msg.includes("invalid authentication credentials") || response.status === 401 || response.status === 403) {
            msg = "The API key you provided is invalid. Please go to https://aistudio.google.com/app/apikey to generate a valid key (it must start with 'AIzaSy').";
        }
        
        throw new Error(msg);
    }

    return response;
}

async function streamResponse(messages, targetBubbleId, systemPrompt) {
    let fullText = '';
    const bubble = $(targetBubbleId);

    try {
        const response = await callGemini(messages, systemPrompt);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Show cursor
        if (bubble) bubble.innerHTML = '<span class="typing-cursor"></span>';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line in the buffer

            for (const line of lines) {
                if (!line.trim()) continue;
                if (!line.startsWith('data: ')) continue;

                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const token = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (token) {
                        fullText += token;
                        if (bubble) {
                            bubble.innerHTML = formatAIText(fullText) + '<span class="typing-cursor"></span>';
                            scrollToBottom();
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors for incomplete data chunks
                }
            }
        }

        // Final render without cursor
        if (bubble) bubble.innerHTML = formatAIText(fullText);

    } catch (err) {
        fullText = `⚠️ Error: ${err.message}. Please check your API key in Settings or try again.`;
        if (bubble) bubble.innerHTML = formatAIText(fullText);
        throw err;
    }

    return fullText;
}

// ================================================================
// SEND MESSAGE FLOW
// ================================================================
async function sendMessage(userText) {
    userText = userText.trim();
    if (!userText || State.isStreaming) return;
    // if (!State.apiKey) { showApiKeyModal(); return; }

    // Ensure active session
    let session = getCurrentSession();
    if (!session) session = createNewSession();

    State.isStreaming = true;
    setStatusThinking();
    hideWelcome();
    DOM.sendBtn.disabled = true;

    // Append user message to DOM and session
    appendMessageBubble('user', userText);
    session.messages.push({ role: 'user', text: userText, timestamp: Date.now() });

    // Remove old feedback buttons
    removeFeedbackButtons();

    // Update session title from first message
    if (session.messages.filter(m => m.role === 'user').length === 1) {
        session.title = userText.slice(0, 52) + (userText.length > 52 ? '…' : '');
        renderHistory();
    }

    // Track problem for retry
    if (State.attemptCount === 0) State.lastProblem = userText;

    scrollToBottom();

    // Show thinking animation
    appendThinkingBubble();
    scrollToBottom();

    // Prepare a placeholder bubble for streaming
    removeThinkingBubble();
    const { bubbleId } = appendMessageBubble('model', '', true);
    const bubble = $(bubbleId);
    if (bubble) bubble.innerHTML = '<span class="typing-cursor"></span>';

    // Build history for API (last 20 messages for context)
    const historyForApi = session.messages.slice(-20);

    let aiText = '';
    try {
        const systemPrompt = buildSystemPrompt();
        aiText = await streamResponse(historyForApi, bubbleId, systemPrompt);
    } catch (err) {
        console.error('Gemini error:', err);
        aiText = '⚠️ ' + err.message;
        setStatusOnline();
    }

    // Save AI response to session
    session.messages.push({ role: 'model', text: aiText, timestamp: Date.now() });
    session.updatedAt = Date.now();
    saveSessions();
    State.attemptCount++;
    State.previousSolutions.push(userText.slice(0, 80));

    // Show feedback buttons
    appendFeedbackButtons(userText);
    scrollToBottom();

    State.isStreaming = false;
    setStatusOnline();
    DOM.sendBtn.disabled = false;
    DOM.chatInput.focus();
}

// ================================================================
// FEEDBACK HANDLERS
// ================================================================
async function handleFeedback(worked, problemSummary) {
    removeFeedbackButtons();

    if (worked) {
        // User says it worked — ask for prevention/best practices
        const successPrompt = `The user confirmed that the previous solution worked for their problem: "${problemSummary}". 
Now provide a comprehensive follow-up with these sections:
✔️ **Why This Happened** — explain the root cause in simple terms
🛡️ **Prevention Tips** — 3-4 specific ways to prevent this in the future
⭐ **Best Practices** — 2-3 related best practices
📊 **Severity Level** — State the severity (Low/Medium/High/Critical) and explain briefly
💡 **Additional Suggestions** — Any extra tips or tools that would help

Keep it concise, friendly, and practical. Respond in the same language the user has been using.`;

        await sendSystemMessage(successPrompt, true);
        State.attemptCount = 0;
        State.previousSolutions = [];
    } else {
        // User says it didn't work — try a different approach
        State.attemptCount++;

        let retryPrompt;
        if (State.attemptCount >= 4) {
            retryPrompt = `The user has tried multiple solutions for: "${problemSummary}" but none worked. 
Previous solutions tried: ${State.previousSolutions.join('; ')}.
This is attempt #${State.attemptCount}.
As a last resort, recommend contacting a professional technician or service center. 
Explain what information they should bring (symptoms, error messages, what was tried). 
Also suggest any online resources (official support pages, communities) where they might get help.
Be empathetic and reassuring. Respond in the same language the user has been using.`;
        } else {
            retryPrompt = `The previous solution did NOT work for the user's problem: "${problemSummary}".
This is troubleshooting attempt #${State.attemptCount + 1}.
Previous solutions already tried: ${State.previousSolutions.join('; ')}.
Analyze the problem from a COMPLETELY DIFFERENT angle and provide an entirely different troubleshooting approach.
Do NOT repeat any of the previous solutions.
Use the same response format: 🔍 Problem Analysis, ❓ Possible Causes, ✅ Step-by-Step Solution, ⚠️ Important Notes.
Be specific and try a deeper, more advanced approach this time.
Respond in the same language the user has been using.`;
        }

        await sendSystemMessage(retryPrompt, false);
    }
}

async function sendSystemMessage(prompt, isSuccess) {
    if (State.isStreaming) return;
    if (!State.apiKey) return;

    let session = getCurrentSession();
    if (!session) return;

    State.isStreaming = true;
    setStatusThinking();
    DOM.sendBtn.disabled = true;

    // Add an internal system message to history
    session.messages.push({ role: 'user', text: prompt, timestamp: Date.now() });

    // Show thinking
    appendThinkingBubble();
    scrollToBottom();
    await sleep(400);
    removeThinkingBubble();

    // Create bubble for streaming
    const { bubbleId } = appendMessageBubble('model', '', true);
    const bubble = $(bubbleId);
    if (bubble) bubble.innerHTML = '<span class="typing-cursor"></span>';

    const historyForApi = session.messages.slice(-20);
    let aiText = '';
    try {
        const systemPrompt = buildSystemPrompt();
        aiText = await streamResponse(historyForApi, bubbleId, systemPrompt);
    } catch (err) {
        aiText = '⚠️ ' + err.message;
    }

    session.messages.push({ role: 'model', text: aiText, timestamp: Date.now() });
    session.updatedAt = Date.now();
    saveSessions();

    if (!isSuccess) {
        appendFeedbackButtons(State.lastProblem);
    }

    scrollToBottom();
    State.isStreaming = false;
    setStatusOnline();
    DOM.sendBtn.disabled = false;
    DOM.chatInput.focus();
}

// ================================================================
// UI HELPERS
// ================================================================
function scrollToBottom(instant = false) {
    const area = DOM.chatArea;
    area.scrollTo({ top: area.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setStatusThinking() {
    DOM.headerStatusDot.className = 'status-dot thinking';
    DOM.headerStatusText.textContent = 'AI Thinking…';
    DOM.sidebarStatusText.textContent = 'Thinking…';
}

function setStatusOnline() {
    DOM.headerStatusDot.className = 'status-dot online';
    DOM.headerStatusText.textContent = 'AI Online';
    DOM.sidebarStatusText.textContent = 'Online';
}

function copyMessage(bubbleId, btn) {
    const bubble = $(bubbleId);
    if (!bubble) return;
    const text = bubble.innerText || bubble.textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        }, 2000);
    }).catch(() => showToast('Failed to copy'));
}

function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function clearChat() {
    if (!State.currentSessionId) return;
    const session = getCurrentSession();
    if (!session) return;
    session.messages = [];
    session.title = 'New Chat';
    session.updatedAt = Date.now();
    State.attemptCount = 0;
    State.previousSolutions = [];
    State.lastProblem = '';
    saveSessions();
    renderHistory();
    DOM.messagesContainer.innerHTML = '';
    removeFeedbackButtons();
    showWelcome();
    showToast('Chat cleared');
}

function exportChat() {
    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
        showToast('No messages to export');
        return;
    }

    let content = `TechDoc AI Chat Export\n`;
    content += `Session: ${session.title}\n`;
    content += `Date: ${new Date(session.createdAt).toLocaleString()}\n`;
    content += `${'─'.repeat(60)}\n\n`;

    session.messages.forEach(msg => {
        const sender = msg.role === 'user' ? 'You' : 'TechDoc AI';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        content += `[${time}] ${sender}:\n${msg.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techdoc-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat exported!');
}

// ================================================================
// API KEY MODAL
// ================================================================
function showApiKeyModal() {
    DOM.apiKeyModal.style.display = 'flex';
    DOM.apiKeyError.style.display = 'none';
    DOM.apiKeyError.textContent = '';
    setTimeout(() => DOM.apiKeyInput.focus(), 100);
}

function hideApiKeyModal() {
    DOM.apiKeyModal.style.display = 'none';
}

function saveApiKey() {
    const key = DOM.apiKeyInput.value.trim();
    if (!key) {
        showApiKeyError('Please enter your Gemini API key.');
        return;
    }
    State.apiKey = key;
    localStorage.setItem('techdoc_apikey', key);
    hideApiKeyModal();
    startApp();
}

function showApiKeyError(msg) {
    DOM.apiKeyError.style.display = 'block';
    DOM.apiKeyError.textContent = msg;
}

// ================================================================
// SETTINGS MODAL
// ================================================================
function showSettings() {
    DOM.settingsApiInput.value = State.apiKey;
    DOM.settingsApiInput.type = 'password';
    DOM.modelSelect.value = State.model;
    DOM.settingsModal.style.display = 'flex';
}

function hideSettings() {
    DOM.settingsModal.style.display = 'none';
}

function saveSettings() {
    const key = DOM.settingsApiInput.value.trim();
    if (key) {
        State.apiKey = key;
        localStorage.setItem('techdoc_apikey', key);
    }
    const model = DOM.modelSelect.value;
    State.model = model;
    localStorage.setItem('techdoc_model', model);
    updateModelBadge();
    hideSettings();
    showToast('Settings saved!');
}

function updateModelBadge() {
    const labels = {
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-1.5-flash-latest': 'Gemini 1.5 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-2.0-flash': 'Gemini 2.0 Flash',
    };
    DOM.modelBadgeText.textContent = labels[State.model] || State.model;
}

// ================================================================
// THEME
// ================================================================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    State.theme = theme;
    localStorage.setItem('techdoc_theme', theme);
    if (theme === 'dark') {
        DOM.themeIconDark.style.display = '';
        DOM.themeIconLight.style.display = 'none';
    } else {
        DOM.themeIconDark.style.display = 'none';
        DOM.themeIconLight.style.display = '';
    }
}

function toggleTheme() {
    applyTheme(State.theme === 'dark' ? 'light' : 'dark');
}

// ================================================================
// CLOCK
// ================================================================
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    DOM.headerClock.textContent = `${h}:${m}`;
}

// ================================================================
// SIDEBAR
// ================================================================
function toggleSidebar() {
    DOM.sidebar.classList.toggle('open');
    DOM.sidebarOverlay.style.display = DOM.sidebar.classList.contains('open') ? 'block' : 'none';
}

function closeSidebarMobile() {
    if (window.innerWidth <= 900) {
        DOM.sidebar.classList.remove('open');
        DOM.sidebarOverlay.style.display = 'none';
    }
}

// ================================================================
// INPUT AUTO-RESIZE
// ================================================================
function autoResizeInput() {
    const el = DOM.chatInput;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// ================================================================
// APP STARTUP
// ================================================================
function startApp() {
    DOM.appShell.style.display = 'flex';

    // Load or create first session
    loadSessions();
    if (State.sessions.length > 0) {
        loadSession(State.sessions[0].id);
    } else {
        createNewSession();
        showWelcome();
    }
    renderHistory();
}

// ================================================================
// INIT
// ================================================================
function init() {
    // ── Populate DOM refs now that the page is fully loaded ──
    DOM.apiKeyModal = $('api-key-modal');
    DOM.settingsModal = $('settings-modal');
    DOM.appShell = $('app-shell');
    DOM.sidebar = $('sidebar');
    DOM.sidebarOverlay = $('sidebar-overlay');
    DOM.historyList = $('history-list');
    DOM.historyEmpty = $('history-empty');
    DOM.chatArea = $('chat-area');
    DOM.welcomeScreen = $('welcome-screen');
    DOM.messagesContainer = $('messages-container');
    DOM.chatInput = $('chat-input');
    DOM.sendBtn = $('send-btn');
    DOM.voiceBtn = $('voice-btn');
    DOM.headerClock = $('header-clock');
    DOM.headerStatusDot = $('header-status-dot');
    DOM.headerStatusText = $('header-status-text');
    DOM.sidebarStatusText = $('sidebar-status-text');
    DOM.modelBadgeText = $('model-badge-text');
    DOM.apiKeyInput = $('api-key-input');
    DOM.toggleKeyVis = $('toggle-key-vis');
    DOM.saveApiKeyBtn = $('save-api-key-btn');
    DOM.apiKeyError = $('api-key-error');
    DOM.settingsApiInput = $('settings-api-key-input');
    DOM.settingsToggleKey = $('settings-toggle-key-vis');
    DOM.modelSelect = $('model-select');
    DOM.saveSettingsBtn = $('save-settings-btn');
    DOM.newChatBtn = $('new-chat-btn');
    DOM.themeToggleBtn = $('theme-toggle-btn');
    DOM.themeIconDark = $('theme-icon-dark');
    DOM.themeIconLight = $('theme-icon-light');
    DOM.settingsBtn = $('settings-btn');
    DOM.closeSettingsBtn = $('close-settings-btn');
    DOM.exportChatBtn = $('export-chat-btn');
    DOM.clearChatBtn = $('clear-chat-btn');
    DOM.sidebarToggleBtn = $('sidebar-toggle-btn');
    DOM.sidebarCloseBtn = $('sidebar-close-btn');
    DOM.welcomeChips = $('welcome-chips');
    DOM.splashScreen = $('splash-screen');

    // Load persisted settings
    const savedKey = localStorage.getItem('techdoc_apikey');
    const savedModel = localStorage.getItem('techdoc_model');
    const savedTheme = localStorage.getItem('techdoc_theme') || 'dark';

    if (savedKey) State.apiKey = savedKey;

    // Default to gemini-2.5-flash
    if (!savedModel || savedModel.includes('1.5') || savedModel === 'gemini-2.0-flash' || savedModel === 'gemini-1.5-flash-latest') {
        localStorage.setItem('techdoc_model', 'gemini-2.5-flash');
        State.model = 'gemini-2.5-flash';
    } else {
        State.model = savedModel;
    }

    applyTheme(savedTheme);
    updateModelBadge();
    updateClock();
    setInterval(updateClock, 10000);

    // Show modal or start app
    startApp();

    // Hide splash screen after animation
    setTimeout(() => {
        if (DOM.splashScreen) {
            DOM.splashScreen.classList.add('hidden');
            setTimeout(() => DOM.splashScreen.remove(), 600);
        }
    }, 2000);

    // ── EVENT LISTENERS ──

    // API Key Modal
    DOM.saveApiKeyBtn.addEventListener('click', saveApiKey);
    DOM.apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
    DOM.toggleKeyVis.addEventListener('click', () => {
        DOM.apiKeyInput.type = DOM.apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    // Settings Modal
    DOM.settingsBtn.addEventListener('click', showSettings);
    DOM.saveSettingsBtn.addEventListener('click', saveSettings);
    DOM.closeSettingsBtn.addEventListener('click', hideSettings);
    DOM.settingsToggleKey.addEventListener('click', () => {
        const input = DOM.settingsApiInput;
        if (input.type === 'password') {
            // Show real key when toggled
            input.value = input.dataset.realKey || input.value;
            input.type = 'text';
        } else {
            input.type = 'password';
        }
    });
    DOM.settingsModal.addEventListener('click', e => { if (e.target === DOM.settingsModal) hideSettings(); });

    // Chat input
    DOM.chatInput.addEventListener('input', () => {
        autoResizeInput();
        DOM.sendBtn.disabled = DOM.chatInput.value.trim() === '' || State.isStreaming;
    });
    DOM.chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = DOM.chatInput.value.trim();
            if (text && !State.isStreaming) {
                DOM.chatInput.value = '';
                autoResizeInput();
                DOM.sendBtn.disabled = true;
                sendMessage(text);
            }
        }
    });

    // Send button
    DOM.sendBtn.addEventListener('click', () => {
        const text = DOM.chatInput.value.trim();
        if (text && !State.isStreaming) {
            DOM.chatInput.value = '';
            autoResizeInput();
            DOM.sendBtn.disabled = true;
            sendMessage(text);
        }
    });

    // New Chat
    DOM.newChatBtn.addEventListener('click', () => {
        const session = createNewSession();
        showWelcome();
        renderHistory();
        closeSidebarMobile();
        DOM.chatInput.focus();
    });

    // Theme toggle
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);

    // Export / Clear
    DOM.exportChatBtn.addEventListener('click', exportChat);
    DOM.clearChatBtn.addEventListener('click', clearChat);

    // Sidebar toggle (3-dash button in header)
    if (DOM.sidebarToggleBtn) {
        DOM.sidebarToggleBtn.addEventListener('click', () => {
            DOM.sidebar.classList.toggle('open');
            if (DOM.sidebarOverlay) {
                DOM.sidebarOverlay.style.display = DOM.sidebar.classList.contains('open') ? 'block' : 'none';
            }
        });
    }
    // Sidebar close (X button inside sidebar on mobile)
    if (DOM.sidebarCloseBtn) {
        DOM.sidebarCloseBtn.addEventListener('click', closeSidebarMobile);
    }
    if (DOM.sidebarOverlay) {
        DOM.sidebarOverlay.addEventListener('click', closeSidebarMobile);
    }

    // Welcome chips
    DOM.welcomeChips.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
            DOM.chatInput.value = prompt;
            autoResizeInput();
            DOM.sendBtn.disabled = false;
            DOM.chatInput.focus();
            // Optionally auto-send
            DOM.chatInput.value = '';
            autoResizeInput();
            DOM.sendBtn.disabled = true;
            sendMessage(prompt);
        }
    });

    // Keyboard shortcut: Ctrl+/ or Cmd+/ to focus input
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            DOM.chatInput.focus();
        }
    });

    // ==========================================
    // VOICE RECOGNITION (Web Speech API)
    // ==========================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        DOM.voiceBtn.disabled = false;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        // You can set language here if you want to enforce Tamil or English
        // recognition.lang = 'en-US'; // or 'ta-IN'

        let isRecording = false;

        recognition.onstart = () => {
            isRecording = true;
            DOM.voiceBtn.classList.add('recording');
            DOM.chatInput.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                DOM.chatInput.value += finalTranscript + ' ';
                autoResizeInput();
                DOM.sendBtn.disabled = false;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            DOM.chatInput.placeholder = "Describe your technical problem...";
            showToast('Microphone error: ' + event.error);
        };

        recognition.onend = () => {
            isRecording = false;
            DOM.voiceBtn.classList.remove('recording');
            DOM.chatInput.placeholder = "Describe your technical problem...";
        };

        DOM.voiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        DOM.voiceBtn.title = "Voice input not supported in this browser";
    }
}

// ================================================================
// EXPOSE GLOBALS (for inline onclick handlers)
// ================================================================
window.deleteSession = deleteSession;
window.handleFeedback = handleFeedback;
window.copyMessage = copyMessage;

// ── BOOT
document.addEventListener('DOMContentLoaded', init);
