const config = require('./config')
const io = require('socket.io')(config.proxy.port)
const io_client = require('socket.io-client')

const server_configs = config.servers

const servers = []

const server_client_counts = []

for(let i = 0; i < server_configs.length; i++) {
    servers.push(io_client.connect(`http://${server_configs[i].ip}:${server_configs[i].port}/proxy`))
    server_client_counts.push(0)

    servers[i].on('client_change', (server_id, client_count) => {
        server_client_counts[server_id] = client_count
    })
}



io.on('connection', (socket) => {
    console.log('A client has connected to me.')
    
    socket.on('request', () => {
        console.log('Recieved redirect request, finding best server for client...')
        var least_traffic = server_client_counts[0]
        var least_index = 0
        var server_found = false
        for(let i = 0; i < server_client_counts.length; i++) {
            if(least_traffic >= server_client_counts[i] && servers[i].connected) {
                least_index = i
                least_traffic = server_client_counts[i]
                server_found = true
            }
        }

        if(server_found) {
            console.log('Server found, redirectung client...')
            socket.emit('redirect', server_configs[least_index].ip, server_configs[least_index].port)
        } else {
            console.log('Error: No servers up at this time.')
            socket.emit('errors', 'No servers are available at this time, please try again later.')
        }
    })
})

console.log('Proxy server in listening mode.')