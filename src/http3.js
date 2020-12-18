'use strict';
const fs = require('fs');
const path = require('path');
const cert = fs.readFileSync(path.join(__dirname, '../ssl/cert.pem'));
const key = fs.readFileSync(path.join(__dirname, '../ssl/key.pem'));

const net = require('net');

// Create the QUIC UDP IPv4 socket bound to local IP port 1234
const socket = net.createQuicSocket({ endpoint: { port: 1234 } });

socket.on('session', async (session) => {
    // A new server side session has been created!

    // The peer opened a new stream!
    session.on('stream', (stream) => {
        // Let's say hello
        stream.end('Hello World');

        // Let's see what the peer has to say...
        stream.setEncoding('utf8');
        stream.on('data', console.log);
        stream.on('end', () => console.log('stream ended'));
    });

    const uni = await session.openStream({ halfOpen: true });
    uni.write('hi ');
    uni.end('from the server!');
});

// Tell the socket to operate as a server using the given
// key and certificate to secure new connections, using
// the fictional 'hello' application protocol.
(async function () {
    await socket.listen({ key, cert, alpn: 'hello' });
    console.log('The socket is listening for sessions!');
})();