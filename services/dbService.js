const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tu_base_de_datos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 1. Buscar Artículos con URL de imagen lista
async function buscarArticulosEnDB(terminoBusqueda) {
    const rawSearch = terminoBusqueda ? terminoBusqueda.trim() : '';
    const searchTerms = rawSearch
        ? rawSearch.split(' ').filter(w => w.length > 2).map(word => `+${word}*`).join(' ')
        : null;

    const baseURL = process.env.SERVER_DEV || 'http://localhost:3000/';

    try {
        let querySql = `
            SELECT 
                a.id, a.clave, a.codigo, a.descripcion,
                c.nombre AS categoria, 
                m.nombre AS marca,
                ROUND(a.precio3 * 1.16, 2) AS precio1,
                IF(s.existencia IS NULL, 0, s.existencia) AS existencia,
                d.imagen1
            FROM articulos AS a
            LEFT JOIN stock AS s ON a.id = s.articulo_id
            INNER JOIN categorias AS c ON c.id = a.categoria_id 
            INNER JOIN marcas AS m ON m.id = a.marca_id 
            LEFT JOIN descripciones AS d ON d.articulo_id = a.id 
            WHERE a.is_active = TRUE 
            AND a.is_deleted = 0 
            AND s.tienda_id = 4
            AND a.precio3 > 0 AND a.precio4 > 0
        `;

        const searchWildcard = `%${rawSearch}%`;
        const queryParams = [searchWildcard, searchWildcard, searchWildcard];
        if (searchTerms) queryParams.push(searchTerms);

        if (rawSearch) {
            querySql += `
                AND (
                    a.clave LIKE ? OR 
                    a.codigo LIKE ? OR 
                    m.nombre LIKE ? OR 
                    c.nombre LIKE ? 
                    ${searchTerms ? ` OR MATCH(a.descripcion) AGAINST(? IN BOOLEAN MODE)` : ` OR a.descripcion LIKE ?`}
                )
            `;
            queryParams.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
            searchTerms ? queryParams.push(searchTerms) : queryParams.push(searchWildcard);
        }

        querySql += ` ORDER BY a.descripcion ASC LIMIT 4`; // Limitamos a 4 para no saturar el chat de WhatsApp

        const [articulos] = await pool.query(querySql, queryParams);

        return articulos.map(art => ({
            ...art,
            imagen1: art.imagen1 ? `${baseURL}${art.imagen1}` : null
        }));
    } catch (err) {
        console.error("Error al buscar artículos en BD:", err);
        throw err;
    }
}

// 2. Consultar Promociones Vigentes con imagen lista
async function obtenerPromocionesActivas() {
    const baseURL = process.env.SERVER_DEV || 'http://localhost:3000/';
    const frontendURL = process.env.FRONTEND_URL || 'https://comcorr.com.mx';

    try {
        const [promos] = await pool.query(`
            SELECT id, nombre, descripcion, fecha_inicio, fecha_fin, url_imagen
            FROM promociones
            WHERE active = TRUE AND CURDATE() BETWEEN fecha_inicio AND fecha_fin
            ORDER BY fecha_inicio DESC
            LIMIT 3;
        `);

        return promos.map(promo => ({
            ...promo,
            url_imagen: promo.url_imagen ? `${baseURL}${promo.url_imagen}` : null,
            enlaceWeb: `${frontendURL}/promociones/${promo.nombre.replace(/\s+/g, "-").toLowerCase()}-${promo.id}`
        }));
    } catch (err) {
        console.error("Error al obtener promociones:", err);
        throw err;
    }
}

// 3. Consultar Pedido por ID
async function obtenerPedidoPorId(pedidoId) {
    try {
        const pedidosQuery = `
          SELECT 
            v.id AS pedido_id,
            v.fecha_venta,
            s.nombre AS sucursal,
            v.estado_referencia_mp AS estado_pago,
            u.phone AS telefono_usuario, -- Suponiendo que la tabla usuarios tiene el campo telefono
            u.email AS correo_usuario,       -- O correo electrónico
            (SELECT SUM(dv.cantidad) FROM detalle_ventas dv WHERE dv.venta_id = v.id) AS total_articulos,
            (SELECT SUM(dv.total) FROM detalle_ventas dv WHERE dv.venta_id = v.id) AS total_pedido,
            ep.nombre AS estado_actual
          FROM ventas v
          INNER JOIN Sucursales s ON s.id = v.tienda_id
          LEFT JOIN usuarios u ON u.id = v.usuario_id -- Ajusta el nombre de tu tabla de usuarios si es diferente
          LEFT JOIN (
              SELECT sp.ventas_id, ep.nombre
              FROM seguimiento_pedidos sp
              INNER JOIN (
                  SELECT ventas_id, MAX(fecha) AS max_fecha
                  FROM seguimiento_pedidos
                  GROUP BY ventas_id
              ) ult ON ult.ventas_id = sp.ventas_id AND ult.max_fecha = sp.fecha
              INNER JOIN estados_pedidos ep ON ep.id = sp.estado_id
          ) AS ep ON ep.ventas_id = v.id
          WHERE v.id = ?;
        `;

        const [pedidos] = await pool.query(pedidosQuery, [pedidoId]);
        if (pedidos.length === 0) return null;

        const pedido = pedidos[0];
        const detallesQuery = `
          SELECT dv.articulo_id, a.descripcion, dv.cantidad, dv.precio, dv.total
          FROM detalle_ventas dv
          LEFT JOIN articulos a ON a.id = dv.articulo_id
          WHERE dv.venta_id = ?;
        `;

        const [detalles] = await pool.query(detallesQuery, [pedidoId]);
        pedido.detalles = detalles;
        return pedido;
    } catch (err) {
        console.error("Error al consultar pedido en BD:", err);
        throw err;
    }
}

module.exports = { buscarArticulosEnDB, obtenerPromocionesActivas, obtenerPedidoPorId };