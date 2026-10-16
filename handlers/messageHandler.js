const { MessageMedia } = require('whatsapp-web.js');
const { buscarArticulosEnDB, obtenerPromocionesActivas, obtenerPedidoPorId } = require('../services/dbService');
const { obtenerRespuestaFAQ } = require('./faqHandler');
const sessions = new Map();

// --- CONTROL DE INACTIVIDAD (Auto-recordatorio sin consumo excesivo) ---
// Revisa cada 5 minutos si algún usuario lleva más de 20 minutos inactivo en un submenú
setInterval(async () => {
    const ahora = Date.now();
    for (const [chatId, sesion] of sessions.entries()) {
        if (sesion.estado && sesion.estado !== 'MENU_PRINCIPAL' && !sesion.avisoInactivoEnviado) {
            const tiempoInactivo = ahora - (sesion.lastInteraction || ahora);
            const TIEMPO_LIMITE = 20 * 60 * 1000; // 20 minutos

            if (tiempoInactivo > TIEMPO_LIMITE) {
                try {
                    // Nota: Usamos la importación del cliente de whatsapp de manera global en el archivo
                    const clientInstance = require('../config/whatsapp');
                    await clientInstance.sendMessage(chatId, "Hola, ¿sigues ahí? 😊 Veo que dejamos pendiente tu consulta. Escribe *MENU* para volver al inicio o continúa con lo que estabas haciendo.");
                    sesion.avisoInactivoEnviado = true; // Marca para no repetir el aviso spam
                } catch (err) {
                    console.error("Error al enviar mensaje de inactividad:", err);
                }
            }
        }
    }
}, 5 * 60 * 1000); // Se ejecuta cada 5 minutos

async function handleIncomingMessage(msg, client) {
    try {
        if (!msg.body || msg.body.trim() === "") return;

        let contact = await msg.getContact();
        let chatId = msg.from;

        if (msg.from.endsWith('@lid')) {
            chatId = contact.id._serialized;
        }

        const texto = msg.body.trim();
        const textoLower = texto.toLowerCase();
        let sesion = sessions.get(chatId);

        // Si el usuario escribe algo, actualizamos su última interacción y reseteamos el aviso de inactividad
        if (sesion) {
            sesion.lastInteraction = Date.now();
            sesion.avisoInactivoEnviado = false;
        }

        const respuestaFaq = obtenerRespuestaFAQ(textoLower);
        if (respuestaFaq) {
            await msg.reply(respuestaFaq);
            return; // Detenemos el flujo para que responda la duda y conserve el estado actual
        }

        // Saludo inicial
        if (!sesion) {
            const saludoInicial = `¡Hola! 👋 Bienvenido/a a nuestra tienda online ComCorr. 🛍️\n\n¿Qué te gustaría hacer hoy? Elige una opción:\n\n1️⃣ Buscar artículos o productos 🔍\n2️⃣ Ver Promociones vigentes 🔥\n3️⃣ Consultar estatus de mi pedido 📦\n4️⃣ Hablar con un asesor humano 💬`;
            await msg.reply(saludoInicial);

            sessions.set(chatId, {
                nombreCliente: contact.pushname || "Cliente",
                estado: 'MENU_PRINCIPAL',
                lastInteraction: Date.now(),
                avisoInactivoEnviado: false
            });
            return;
        }

        if (textoLower === 'menu' || textoLower === 'inicio') {
            sesion.estado = 'MENU_PRINCIPAL';
            // Limpiamos datos temporales de pedidos si existieran al volver al menú
            delete sesion.pedidoTempId;
            delete sesion.pedidoDatos;
            delete sesion.subEstado;

            await msg.reply("🏠 *Menú Principal:*\n\n1️⃣ Buscar artículos o productos 🔍\n2️⃣ Ver Promociones vigentes 🔥\n3️⃣ Consultar estatus de mi pedido 📦\n4️⃣ Hablar con un asesor humano 💬\n\n_Escribe el número de tu opción:_");
            return;
        }

        switch (sesion.estado) {
            case 'MENU_PRINCIPAL':
                if (texto === '1' || textoLower.includes('buscar') || textoLower.includes('articulo') || textoLower.includes('producto')) {
                    sesion.estado = 'BUSCANDO_ARTICULOS';
                    await msg.reply("🔍 Claro que sí. **¿Qué producto estás buscando?** (Escribe el nombre, marca o categoría, por ejemplo: *refrigerador*, *lg*, *estufa*):");
                }
                else if (texto === '2' || textoLower.includes('promo') || textoLower.includes('oferta')) {
                    await msg.reply("🔥 Buscando las promociones vigentes con sus imágenes...");

                    const promos = await obtenerPromocionesActivas();
                    if (promos.length > 0) {
                        for (const promo of promos) {
                            let textoPromo = `🔥 *${promo.nombre}*\n`;
                            textoPromo += `📝 ${promo.descripcion}\n`;
                            textoPromo += `🔗 Ver en la web: ${promo.enlaceWeb}`;

                            if (promo.url_imagen) {
                                try {
                                    const media = await MessageMedia.fromUrl(promo.url_imagen);
                                    await client.sendMessage(chatId, media, { caption: textoPromo });
                                } catch (imgErr) {
                                    await client.sendMessage(chatId, textoPromo);
                                }
                            } else {
                                await client.sendMessage(chatId, textoPromo);
                            }
                        }
                        await msg.reply("_Escribe *MENU* para volver al inicio o busca otro producto._");
                    } else {
                        await msg.reply("❌ Por el momento no tenemos promociones activas. Escribe *MENU* para volver al inicio.");
                    }
                }
                else if (texto === '3' || textoLower.includes('pedido') || textoLower.includes('rastreo')) {
                    sesion.estado = 'CONSULTANDO_PEDIDO';
                    await msg.reply("📦 Por favor, **escribe el número de ID de tu pedido**:");
                }
                else if (texto === '4' || textoLower.includes('asesor') || textoLower.includes('humano')) {
                    sesion.estado = 'ATENCION_HUMANA';
                    await msg.reply("👨‍💻 Hemos notificado a soporte. Un asesor se pondrá en contacto contigo muy pronto. ✨");
                }
                else {
                    await msg.reply("⚠️ Opción no válida. Por favor responde con un número del **1 al 4**, o escribe *MENU*.");
                }
                break;

            case 'BUSCANDO_ARTICULOS':
                if (textoLower === 'menu') {
                    sesion.estado = 'MENU_PRINCIPAL';
                    await msg.reply("Regresamos al menú principal:\n\n1️⃣ Buscar artículos\n2️⃣ Ver Promociones\n3️⃣ Consultar pedido\n4️⃣ Hablar con asesor");
                    break;
                }

                await msg.reply("🔍 Buscando artículos en inventario...");
                const articulosEncontrados = await buscarArticulosEnDB(texto);
                const frontendURL = process.env.FRONTEND_URL || 'https://comcorr.com.mx';

                if (articulosEncontrados.length > 0) {
                    let respuestaUnica = `📦 *Resultados para "${texto}":*\n\n`;

                    articulosEncontrados.forEach((art, idx) => {
                        const slug = art.descripcion
                            .toLowerCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/["']/g, "")
                            .replace(/[^a-z0-9\s-]/g, "")
                            .trim()
                            .replace(/\s+/g, "-");

                        const urlProducto = `${frontendURL}/producto/${slug}-${art.id}`;

                        respuestaUnica += `*${idx + 1}. ${art.descripcion}*\n`;
                        respuestaUnica += `🏷️ Marca: ${art.marca} | Cat: ${art.categoria}\n`;
                        respuestaUnica += `💰 *Precio:* $${art.precio1} MXN | 📦 *Stock:* ${art.existencia} pzas\n`;
                        respuestaUnica += `🔗 Ver producto: ${urlProducto}\n\n`;
                    });

                    respuestaUnica += "_¿Buscas algo más? Escribe otro término o *MENU* para volver al inicio._";
                    await msg.reply(respuestaUnica);

                } else {
                    await msg.reply(`❌ No encontramos artículos que coincidan con "${texto}". Intenta con otra palabra clave o escribe *MENU* para regresar.`);
                }
                break;

            case 'CONSULTANDO_PEDIDO':
                if (textoLower === 'menu') {
                    sesion.estado = 'MENU_PRINCIPAL';
                    delete sesion.pedidoTempId;
                    delete sesion.pedidoDatos;
                    delete sesion.subEstado;
                    await msg.reply("Regresamos al menú principal.");
                    break;
                }

                if (!sesion.pedidoTempId) {
                    const numeroPedido = texto.replace(/\D/g, '');
                    if (!numeroPedido) {
                        await msg.reply("❌ Por favor ingresa un número de pedido válido (solo dígitos). O escribe *MENU*.");
                        return;
                    }

                    const pedido = await obtenerPedidoPorId(numeroPedido);
                    if (!pedido) {
                        await msg.reply(`❌ No encontramos ningún pedido con el ID #${numeroPedido}. Verifica el número o escribe *MENU*.`);
                        return;
                    }

                    sesion.pedidoTempId = numeroPedido;
                    sesion.pedidoDatos = pedido;
                    sesion.subEstado = 'VALIDANDO_IDENTIDAD';

                    await msg.reply("🔒 Para proteger tu privacidad, por favor **escribe el correo electrónico** registrado en esa compra:");
                    break;
                }

                if (sesion.subEstado === 'VALIDANDO_IDENTIDAD') {
                    const correoIngresado = texto.trim().toLowerCase();
                    const pedido = sesion.pedidoDatos;

                    if (pedido.correo_usuario && pedido.correo_usuario.toLowerCase() === correoIngresado) {
                        let respuesta = `✅ *¡Identidad confirmada!*\n\n📦 *Detalle del Pedido #${pedido.pedido_id}*\n\n`;
                        respuesta += `📅 *Fecha:* ${new Date(pedido.fecha_venta).toLocaleDateString()}\n`;
                        respuesta += `🏢 *Sucursal:* ${pedido.sucursal}\n`;
                        respuesta += `📌 *Estatus:* ${pedido.estado_actual || 'Registrado'}\n`;
                        respuesta += `💳 *Pago:* ${pedido.estado_pago || 'Pendiente'}\n`;
                        respuesta += `💰 *Total:* $${pedido.total_pedido} MXN\n\n`;

                        respuesta += `🛍️ *Artículos (${pedido.total_articulos}):*\n`;
                        pedido.detalles.forEach((item, idx) => {
                            respuesta += `  ${idx + 1}. ${item.descripcion} (Cant: ${item.cantidad}) - $${item.total}\n`;
                        });

                        respuesta += `\n_Escribe *MENU* para volver al inicio._`;

                        delete sesion.pedidoTempId;
                        delete sesion.pedidoDatos;
                        delete sesion.subEstado;
                        sesion.estado = 'MENU_PRINCIPAL';

                        await msg.reply(respuesta);
                    } else {
                        await msg.reply("❌ El correo no coincide con el registrado en este pedido. Inténtalo de nuevo o escribe *MENU* para volver al inicio.");
                    }
                }
                break;

            case 'ATENCION_HUMANA':
                if (textoLower === 'menu') {
                    sesion.estado = 'MENU_PRINCIPAL';
                    await msg.reply("Has vuelto al asistente virtual.");
                }
                break;
        }

    } catch (error) {
        console.error("💥 Error en manejador de mensajes:", error);
    }
}

module.exports = { handleIncomingMessage, sessions };