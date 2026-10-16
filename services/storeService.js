// Simulación de base de datos de productos y pedidos de tu e-commerce
const productosMock = [
    { id: 1, nombre: "Tenis Deportivos Running", precio: "$1,299 MXN", stock: "Disponible" },
    { id: 2, nombre: "Mochila Antirrobo TechCore", precio: "$850 MXN", stock: "Últimas piezas" },
    { id: 3, nombre: "Smartwatch Deportivo S3", precio: "$1,499 MXN", stock: "Disponible" }
];

const pedidosMock = {
    "ORD-1001": { status: "En camino 🚚", entrega: "Llega mañana", paquetería: "DHL" },
    "ORD-1002": { status: "Preparando en almacén 📦", entrega: "En 2 días hábiles", paquetería: "Estafeta" }
};

// Buscar producto por palabra clave
function buscarProducto(termino) {
    const terminoBusqueda = termino.toLowerCase();
    const encontrados = productosMock.filter(p => p.nombre.toLowerCase().includes(terminoBusqueda));
    return encontrados;
}

// Consultar estatus de pedido por número de orden
function consultarPedido(numeroOrden) {
    const ordenLimpia = numeroOrden.trim().toUpperCase();
    return pedidosMock[ordenLimpia] || null;
}

module.exports = { buscarProducto, consultarPedido };