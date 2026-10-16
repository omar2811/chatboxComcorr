// handlers/faqHandler.js

function obtenerRespuestaFAQ(textoLower) {
    // 1. Horarios y Sucursales (Basado en datos reales de Comcorr)
    if (textoLower.includes('horario') || textoLower.includes('abren') || textoLower.includes('sucursal') || textoLower.includes('ubicacion') || textoLower.includes('direccion')) {
        return `🕒 *Sucursales y Horarios Comcorr:*\n\n` +
            `📍 *COMCORR MACUSPANA*\n` +
            `🏠 Benito Juárez 228, Centro\n` +
            `⏰ Lunes a Sábado: 9:00 AM - 6:00 PM\n` +
            `📞 Tel: 936 111 4186\n\n` +
            `📍 *COMCORR EMILIANO ZAPATA*\n` +
            `🏠 C. Corregidora 102, Centro\n` +
            `⏰ Lunes a Sábado: 9:00 AM - 6:00 PM\n` +
            `📞 Tel: 934 102 1807\n\n` +
            `_Escribe *MENU* para volver al inicio._`;
    }

    // 2. Envíos a domicilio y cobertura
    if (textoLower.includes('envio') || textoLower.includes('domicilio') || textoLower.includes('entrega') || textoLower.includes('cobertura')) {
        return `🚚 *Políticas de Envíos Comcorr:*\n\n` +
            `• Los productos se envían a domicilio o a ocurre por medio de paquetería o mensajería privada.\n` +
            `• El peso estándar de cada envío es de **15 KG**. En caso de rebasar este peso, se notificará un cargo por sobrepeso vía web, correo o teléfono.\n` +
            `• El tiempo de entrega se determina según la paquetería elegida al momento de tu compra.\n\n` +
            `_Escribe *MENU* para volver al inicio._`;
    }

    // 3. Métodos de pago (Mercado Pago)
    if (textoLower.includes('pago') || textoLower.includes('tarjeta') || textoLower.includes('transferencia') || textoLower.includes('efectivo') || textoLower.includes('mercado pago')) {
        return `💳 *Métodos de Pago:*\n\n` +
            `• Aceptamos **cualquier método de pago aceptado por Mercado Pago** (Tarjetas de crédito/débito, transferencias y efectivo en tiendas asociadas de manera segura).\n\n` +
            `_Escribe *MENU* para volver al inicio._`;
    }

    // 4. Apartados (Exclusivo en tienda física)
    if (textoLower.includes('apartado') || textoLower.includes('apartar')) {
        return `🛍️ *Sistema de Apartados:*\n\n` +
            `• El servicio de apartado **solo se maneja directamente en tienda física** (Macuspana y Emiliano Zapata).\n` +
            `• Te invitamos a visitarnos en nuestras sucursales para realizar tu apartado. ✨\n\n` +
            `_Escribe *MENU* para volver al inicio._`;
    }

    // 5. Créditos y Financiamiento (Atrato Pago)
    if (textoLower.includes('credito') || textoLower.includes('financiamiento') || textoLower.includes('atrato') || textoLower.includes('meses') || textoLower.includes('plazos')) {
        return `💳 *Financiamiento y Crédito:*\n\n` +
            `• La tienda no maneja créditos directos propios.\n` +
            `• Sin embargo, contamos con financiamiento disponible a través de **Atrato Pago** para tus compras. 🤝\n` +
            `• Escribe la opción **4** en el menú principal si deseas que un asesor humano te guíe con este proceso.\n\n` +
            `_Escribe *MENU* para volver al inicio._`;
    }

    return null;
}

module.exports = { obtenerRespuestaFAQ };