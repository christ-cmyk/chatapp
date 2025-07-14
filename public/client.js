// Variables globales
let socket;
let currentUser = '';
let typingTimer;
let isTyping = false;

// Références DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const currentUserSpan = document.getElementById('current-user');
const disconnectBtn = document.getElementById('disconnect-btn');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const themeToggle = document.getElementById('theme-toggle');

// Init au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('App démarrée');
    usernameInput.focus();
    setupEventListeners();

    // Thème
    const savedTheme = localStorage.getItem('chat-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        themeToggle.textContent = '☀️';
    }
});

// Écouteurs
function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    messageForm.addEventListener('submit', handleSendMessage);
    disconnectBtn.addEventListener('click', handleDisconnect);
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('keyup', handleStopTyping);

    // Emoji
    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });

    emojiPicker.addEventListener('emoji-click', event => {
        messageInput.value += event.detail.unicode;
    });

    // Thème
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('chat-theme', theme);
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
}

function handleLogin(e) {
    e.preventDefault();
    const username = usernameInput.value.trim();

    if (username.length < 2 || username.length > 20) {
        alert('Nom invalide');
        return;
    }

    currentUser = username;
    initializeSocket();
}

function initializeSocket() {
    // ✅ Connexion à Render au lieu de localhost
    socket = io('https://chatapp-xchk.onrender.com');

    socket.on('connect', () => {
        socket.emit('user_join', currentUser);
        showChatScreen();
    });

    socket.on('connect_error', () => {
        alert('Connexion impossible au serveur.');
    });

    socket.on('message_history', messages => {
        messages.forEach(message => displayMessage(message, false));
        scrollToBottom();
    });

    socket.on('receive_message', data => {
        displayMessage(data, true);
        scrollToBottom();
    });

    socket.on('user_joined', data => {
        displaySystemMessage(data.message, data.timestamp);
        scrollToBottom();
    });

    socket.on('user_left', data => {
        displaySystemMessage(data.message, data.timestamp);
        scrollToBottom();
    });

    socket.on('users_list', updateUsersList);
    socket.on('user_typing', handleUserTyping);

    socket.on('message_reaction', ({ messageId, reaction }) => {
        const messageEl = document.querySelector(`[data-id="${messageId}"]`);
        if (messageEl) {
            const reactionBar = messageEl.querySelector('.reaction-bar');
            const existing = reactionBar.querySelector(`span[data-reaction="${reaction}"]`);
            if (!existing) {
                const span = document.createElement('span');
                span.textContent = reaction;
                span.setAttribute('data-reaction', reaction);
                reactionBar.appendChild(span);
            }
        }
    });
}

function showChatScreen() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUserSpan.textContent = currentUser;
    messageInput.focus();
}

function handleSendMessage(e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message || message.length > 500) return;

    socket.emit('send_message', { message });
    messageInput.value = '';
    messageInput.focus();

    if (isTyping) {
        socket.emit('typing_stop');
        isTyping = false;
    }
}

function displayMessage(data, isNew = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.setAttribute('data-id', data.id || Date.now());

    messageDiv.classList.add(data.username === currentUser ? 'own' : 'other');

    let html = '';
    if (data.username !== currentUser) {
        html += `<div class="message-header">${escapeHtml(data.username)}</div>`;
    }

    html += `<div class="message-content">${escapeHtml(data.message)}</div>`;
    html += `<div class="message-time">${data.timestamp}</div>`;

    html += `
        <div class="reaction-icon" title="Réagir">❤️</div>
        <div class="reaction-menu hidden">
            <span class="reaction" data-react="👍">👍</span>
            <span class="reaction" data-react="❤️">❤️</span>
            <span class="reaction" data-react="😂">😂</span>
            <span class="reaction" data-react="😮">😮</span>
            <span class="reaction" data-react="😢">😢</span>
        </div>
        <div class="reaction-bar"></div>
    `;

    messageDiv.innerHTML = html;
    messagesContainer.appendChild(messageDiv);

    if (isNew) {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px) scale(0.95)';
        setTimeout(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0) scale(1)';
        }, 10);
    }

    const icon = messageDiv.querySelector('.reaction-icon');
    const menu = messageDiv.querySelector('.reaction-menu');
    const bar = messageDiv.querySelector('.reaction-bar');

    icon.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    menu.querySelectorAll('.reaction').forEach(btn => {
        btn.addEventListener('click', () => {
            const reaction = btn.dataset.react;
            socket.emit('react_message', { messageId: messageDiv.dataset.id, reaction });
            menu.classList.add('hidden');
        });
    });
}

function displaySystemMessage(message, timestamp) {
    const div = document.createElement('div');
    div.className = 'message system';
    div.innerHTML = `<div class="message-content">${escapeHtml(message)}</div><div class="message-time">${timestamp}</div>`;
    messagesContainer.appendChild(div);
}

function updateUsersList(users) {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        if (user.username === currentUser) {
            li.style.fontWeight = 'bold';
            li.style.color = '#667eea';
        }
        usersList.appendChild(li);
    });
}

function handleTyping() {
    if (!isTyping) {
        socket.emit('typing_start');
        isTyping = true;
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing_stop');
        isTyping = false;
    }, 1000);
}

function handleStopTyping() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        if (isTyping) {
            socket.emit('typing_stop');
            isTyping = false;
        }
    }, 1000);
}

function handleUserTyping(data) {
    if (data.isTyping) {
        typingText.textContent = `${data.username} est en train d'écrire...`;
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
}

function handleDisconnect() {
    if (confirm('Êtes-vous sûr ?')) {
        socket.disconnect();
        showLoginScreen();
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoginScreen() {
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    usernameInput.value = '';
    currentUser = '';
    usernameInput.focus();
}

window.addEventListener('error', (e) => console.error('Erreur JS :', e.error));
window.addEventListener('beforeunload', () => {
    if (socket) socket.disconnect();
});
