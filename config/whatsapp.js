const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Detectar automáticamente si estamos en Linux (EC2) o Mac
const chromePath = process.platform === 'linux'
    ? '/usr/bin/google-chrome-stable'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: process.env.CLIENT_ID || "ecommerce-bot" }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version-primary/main/html/2.2412.54.html',
    },
    puppeteer: {
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('SCANEA EL QR DE TU E-COMMERCE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot de E-commerce Conectado y Listo');
});

module.exports = client;