const io = require('socket.io-client')
const config = require('./config')
const services = require('./client_services')
const readline = require('readline')
const fs = require('fs')
const { spawn, exec } = require('child_process')
const chalk = require('chalk');

process.chdir('./client_cache')

var connected = false
var client

var current_directory = '/'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: current_directory + ' : '
})

rl.on('line', (line) => {
    if (connected) {
        services.processLine(line, client, current_directory, rl)
    } else {
        console.log('The server has disconnected, trying to reconnect...')
    }
}).on('close', () => {
    console.log('Have a great day!');
    process.exit(0);
});

var proxy_server = io.connect(`http://${config.proxy.ip}:${config.proxy.port}`)

proxy_server.emit('request')

proxy_server.on('redirect', (ip, port) => {
    client = io.connect(`http://${ip}:${port}/client`)

    var temporary_connection
    
    client.on('connect', () => {
        console.log('Connected successfully! You may now start using the system.')
        connected = true
        rl.prompt();
    });
    
    client.on('open_response', (data, fileName, currentPath) => {
        fs.writeFile(fileName, data, 'utf8', () => {
            exec(`gedit ${fileName}`, (error, stdout, stderr) => {
                if (error) {
                  console.error(`exec error: ${error}`)
                  return
                }
                fs.readFile(fileName, 'utf8', (err, data) => {
                    if (err) throw err;
                    client.emit('save', data, fileName, currentPath)
                    console.log('Changes successfully saved.')
                    rl.prompt()
                })
            });
        })
    })
    
    client.on('errors', msg => {
        console.log('Error: ', msg)
        rl.prompt()
    })
    
    client.on('success', msg => {
        console.log('Success: ', msg)
        rl.prompt()
    })
    
    client.on('ls_reply', list => {
        let elements = Object.keys(list)
        for (let i = 0; i < elements.length; i++) {
            if(list[elements[i]].type == 'folder') {
                console.log(chalk.blue(elements[i]))
            } else {
                console.log(chalk.green(elements[i]))
            }
        }
        rl.prompt()
    })
    
    client.on('cd_reply', path => {
        current_directory = path
        rl.setPrompt(current_directory + ' : ')
        rl.prompt()
    })
    
    client.on('redirect_request', (ip, port, fileName, path) => {
        let temporary_connection = io.connect(`http://${ip}:${port}/client`)
        temporary_connection.on('open_response', (data, fileName, currentPath) => {
            console.log(data);
            fs.writeFile(fileName, data, 'utf8', () => {
                exec(`gedit ${fileName}`, (error, stdout, stderr) => {
                    if (error) {
                      console.error(`exec error: ${error}`)
                      return
                    }
                    fs.readFile(fileName, 'utf8', (err, data) => {
                        if (err) throw err;
                        temporary_connection.emit('save', data, fileName, currentPath)
                        temporary_connection.disconnect()
                    })
                    rl.prompt()
                });
            })
        })
        temporary_connection.emit('open', fileName, path)
    
    })
    
    client.on('disconnect', () => {
        connected = false
        console.log('The server has disconnected, trying to reconnect...')
        proxy_server.emit('request')
    })
})

proxy_server.on('errors', (msg) => {
    console.log(msg)
})





