const { MessageMedia } = require('whatsapp-web.js');
const { buscarArticulosEnDB, obtenerPromocionesActivas, obtenerPedidoPorId } = require('../services/dbService');
const { obtenerRespuestaFAQ } = require('./faqHandler'); // <--- Importamos el manejador de FAQ
const sessions = new Map();

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
                estado: 'MENU_PRINCIPAL'
            });
            return;
        }

        if (textoLower === 'menu' || textoLower === 'inicio') {
            sesion.estado = 'MENU_PRINCIPAL';
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
                                    // Descarga y adjunta la imagen de la promo como componente multimedia
                                    const media = await MessageMedia.fromUrl(promo.url_imagen);
                                    await client.sendMessage(chatId, media, { caption: textoPromo });
                                } catch (imgErr) {
                                    // Si falla la imagen, mandamos solo el texto para no romper el flujo
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
                    // Creamos un solo mensaje agrupado limpio
                    let respuestaUnica = `📦 *Resultados para "${texto}":*\n\n`;

                    articulosEncontrados.forEach((art, idx) => {
                        // Generamos el slug amigable para el enlace del producto
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

                    // Enviamos todo en una sola burbuja ordenada
                    await msg.reply(respuestaUnica);

                } else {
                    await msg.reply(`❌ No encontramos artículos que coincidan con "${texto}". Intenta con otra palabra clave o escribe *MENU* para regresar.`);
                }
                break;
            case 'CONSULTANDO_PEDIDO':
                if (textoLower === 'menu') {
                    sesion.estado = 'MENU_PRINCIPAL';
                    await msg.reply("Regresamos al menú principal.");
                    break;
                }

                // Sub-estado 1: Si aún no tenemos el ID del pedido guardado en la sesión temporal
                if (!sesion.pedidoTempId) {
                    const numeroPedido = texto.replace(/\D/g, '');
                    if (!numeroPedido) {
                        await msg.reply("❌ Por favor ingresa un número de pedido válido (solo dígitos). O escribe *MENU*.");
                        return;
                    }

                    // Buscamos si existe el pedido primero
                    const pedido = await obtenerPedidoPorId(numeroPedido);
                    if (!pedido) {
                        await msg.reply(`❌ No encontramos ningún pedido con el ID #${numeroPedido}. Verifica el número o escribe *MENU*.`);
                        return;
                    }

                    // Guardamos temporalmente el ID y pasamos a pedir validación de seguridad (ej. Correo o Teléfono)
                    sesion.pedidoTempId = numeroPedido;
                    sesion.pedidoDatos = pedido;
                    sesion.subEstado = 'VALIDANDO_IDENTIDAD';

                    await msg.reply("🔒 Para proteger tu privacidad, por favor **escribe el correo electrónico** registrado en esa compra:");
                    break;
                }

                // Sub-estado 2: Validar la identidad con el dato proporcionado
                if (sesion.subEstado === 'VALIDANDO_IDENTIDAD') {
                    const correoIngresado = texto.trim().toLowerCase();
                    const pedido = sesion.pedidoDatos;

                    // Validamos si el correo coincide con el registrado en la BD para ese pedido
                    if (pedido.correo_usuario && pedido.correo_usuario.toLowerCase() === correoIngresado) {
                        // ¡Identidad confirmada! Mostramos el pedido completo
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

                        // Limpiamos las variables temporales de validación
                        delete sesion.pedidoTempId;
                        delete sesion.pedidoDatos;
                        delete sesion.subEstado;
                        sesion.estado = 'MENU_PRINCIPAL';

                        await msg.reply(respuesta);
                    } else {
                        // Si falla la validación
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