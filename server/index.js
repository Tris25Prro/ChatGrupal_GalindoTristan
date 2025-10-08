// Importar módulos
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Inicializar Firebase Admin
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Inicializar Express y Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../clientes')));

// 📩 Endpoint REST opcional (si se quiere usar)
// Endpoint para obtener los mensajes (historial)
app.get('/obtener-mensajes', async (req, res) => {
  try {
    const snapshot = await db.collection('mensajes')
      .orderBy('timestamp', 'asc')
      .get();

    const mensajes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        usuario: data.usuario,
        mensaje: data.mensaje,
        timestamp: data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : ''
      };
    });

    res.json(mensajes);
  } catch (err) {
    console.error('Error al obtener mensajes:', err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});


// 🌐 Rutas de cliente y servidor
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../clientes/index.html'));
});

app.get('/servidor', (req, res) => {
  res.sendFile(path.join(__dirname, './servidor.html'));
});

// 🧠 Socket.io - Comunicación en tiempo real
io.on('connection', (socket) => {
  console.log('🟢 Cliente conectado:', socket.id);

  // Escuchar cuando un usuario envía mensaje
  socket.on('enviar-mensaje', async (data) => {
    const { usuario, mensaje } = data;

    if (!usuario || !mensaje) return;

    const nuevoMensaje = {
      usuario,
      mensaje,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // Guardar en Firestore
    await db.collection('mensajes').add(nuevoMensaje);

    // Emitir el mensaje a todos los clientes conectados
    io.emit('nuevo-mensaje', {
      usuario,
      mensaje,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`🌍 Página de usuario: http://localhost:${PORT}/`);
  console.log(`💬 Página del chat: http://localhost:${PORT}/servidor`);
});

//para iniciar con el servidor es: node server/index.js en la terminal