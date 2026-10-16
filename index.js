require('dotenv').config();
const express = require('express');
const client = require('./config/whatsapp');
const { handleIncomingMessage, sessions } = require('./handlers/messageHandler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

// --- ENDPOINT EXTERNO: Para disparar mensajes proactivos desde tu web ---
app.post('/enviar-bienvenida', async (req, res) => {
    const { nombre, numero } = req.body;
    let numeroLimpio = numero.replace(/\D/g, '');
    if (numeroLimpio.startsWith('52') && !numeroLimpio.startsWith('521')) numeroLimpio = '521' + numeroLimpio.substring(2);
    const chatId = `${numeroLimpio}@c.us`;

    try {
        const mensajeBienvenida = `¡Hola *${nombre}*! 👋 Bienvenido/a a nuestra tienda online. 🛍️\n\n¿En qué podemos ayudarte hoy? Responde con el número de tu opción:\n\n1️⃣ Ver Catálogo de Productos 📦\n2️⃣ Rastrear mi pedido 🚚\n3️⃣ Hablar con un asesor humano 💬`;

        await client.sendMessage(chatId, mensajeBienvenida);

        sessions.set(chatId, {
            nombreCliente: nombre,
            estado: 'MENU_PRINCIPAL'
        });

        res.status(200).json({ status: 'Mensaje de bienvenida enviado con éxito' });
    } catch (err) {
        res.status(500).json({ error: "Error al enviar mensaje por WhatsApp" });
    }
});

// --- ESCUCHA DE MENSAJES ENTRANTES ---
client.on('message', async msg => {
    await handleIncomingMessage(msg, client);
});

// --- MANEJADORES DE ESTADO Y AUTO-RECONEXIÓN PARA EVITAR QUE SE DUERMA ---
client.on('auth_failure', msg => {
    console.error('❌ Error de autenticación en WhatsApp:', msg);
});

client.on('disconnected', async (reason) => {
    console.log('⚠️ Cliente de WhatsApp desconectado por:', reason);
    try {
        await client.destroy();
        console.log('🔄 Reiniciando sesión y reconectando cliente automáticamente...');
        setTimeout(() => {
            client.initialize();
        }, 5000);
    } catch (err) {
        console.error('Error al intentar reiniciar el cliente:', err);
    }
});

// --- INICIAR SERVIDOR Y CLIENTE ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP E-commerce corriendo en puerto ${PORT}`);
});

client.initialize();