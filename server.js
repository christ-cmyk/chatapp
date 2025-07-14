// Importation des modules nécessaires
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Création de l'application Express
const app = express();
const server = http.createServer(app);

// Configuration de Socket.IO avec le serveur HTTP
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration pour servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Stockage des utilisateurs connectés
let connectedUsers = new Map();
let messageHistory = []; // Historique des messages (limité en mémoire)

// 📌 Stockage des réactions par messageId
const messageReactions = new Map();

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log(`Nouvel utilisateur connecté: ${socket.id}`);
    
    // Envoi de l'historique des messages
    socket.emit('message_history', messageHistory);

    // Gestion de l'inscription
    socket.on('user_join', (username) => {
        connectedUsers.set(socket.id, {
            id: socket.id,
            username: username,
            joinTime: new Date()
        });

        console.log(`${username} a rejoint le chat`);

        socket.broadcast.emit('user_joined', {
            username: username,
            message: `${username} a rejoint le chat`,
            timestamp: new Date().toLocaleTimeString()
        });

        io.emit('users_list', Array.from(connectedUsers.values()));
    });

    // Réception de message
    socket.on('send_message', (data) => {
        const user = connectedUsers.get(socket.id);

        if (user) {
            const messageData = {
                id: Date.now(),
                username: user.username,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                userId: socket.id,
                reactions: {} // On initialise les réactions
            };

            messageHistory.push(messageData);
            if (messageHistory.length > 100) {
                messageHistory.shift();
            }

            io.emit('receive_message', messageData);
        }
    });

    // 🆕 Réception d'une réaction
    socket.on('react_message', ({ messageId, reaction, username }) => {
        // Recherche du message dans l'historique
        const msg = messageHistory.find(m => m.id === messageId);
        if (msg) {
            // Incrémentation ou mise à jour des réactions
            msg.reactions[reaction] = msg.reactions[reaction] ? msg.reactions[reaction] + 1 : 1;

            // Diffusion à tous les clients
            io.emit('message_reaction', { messageId, reaction, count: msg.reactions[reaction] });
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`${user.username} s'est déconnecté`);

            connectedUsers.delete(socket.id);

            socket.broadcast.emit('user_left', {
                username: user.username,
                message: `${user.username} a quitté le chat`,
                timestamp: new Date().toLocaleTimeString()
            });

            io.emit('users_list', Array.from(connectedUsers.values()));
        }
    });

    // Indicateur de frappe
    socket.on('typing_start', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('user_typing', {
                username: user.username,
                isTyping: true
            });
        }
    });

    socket.on('typing_stop', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('user_typing', {
                username: user.username,
                isTyping: false
            });
        }
    });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur de chat démarré sur le port ${PORT}`);
    console.log(`Accédez à l'application sur http://localhost:${PORT}`);
});
