const fs = require('fs')

function processLine(line, client, current_directory, rl) {
    let tokens = line.split(' ')
    switch(tokens[0].toLowerCase()) {
        case "open":
            if(tokens[1]) {
                client.emit('open', tokens[1], current_directory)
            } else {
                console.log('Insufficient number of arguments.\nFormat: open <filename>')
                rl.prompt()
            }
            break
        case "ls":
            client.emit('ls', current_directory)
            break
        case "mkdir":
            if(tokens[1]) {
                client.emit('mkdir', tokens[1], current_directory)
            } else {
                console.log('Insufficient number of arguments.\nFormat: mkdir <directory_name>')
                rl.prompt()               
            }
            break
        case "create":
            if(tokens[1]) {
                client.emit('create', tokens[1], current_directory)
            } else {
                console.log('Insufficient number of arguments.\nFormat: create <filename>')
                rl.prompt()             
            }
            break
        case "cd":
            if(tokens[1]) {
                client.emit('cd', tokens[1], current_directory)
            } else {
                console.log('Insufficient number of arguments.\nFormat: cd <path>')
                rl.prompt()               
            }
            break
        case "upload":
            if(tokens[1] && tokens[2]) {
                fs.readFile(tokens[1], 'utf8', (err, data) => {
                    if(err) {
                        console.log('Error: ', err)
                        console.log('Please enter a valid file path on your computer.')
                        rl.prompt()
                        return
                    }
                    client.emit('upload', tokens[2], data, current_directory)
                })
            } else {
                console.log('Insufficient number of arguments.\nFormat: upload <file_path> <filename>')
                rl.prompt()                             
            } 
            break
        default:
            console.log('Unrecognised command, try again')
            rl.prompt()
    }
}

module.exports = {
    processLine
}