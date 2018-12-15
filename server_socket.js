const config = require('./config')
const io = require('socket.io')(config.servers[process.argv[2]].port)
const io_client = require('socket.io-client')
const fs = require('fs')
const serverNamespace = io.of('/server')
const clientNamespace = io.of('/client')
const proxyNamespace = io.of('/proxy')
const services = require('./server_services')
var dir_structure = require(config.servers[process.argv[2]].dir_structure)
const buddies = {}
var server_names

var client_count = 0

process.chdir(config.servers[process.argv[2]].root)

proxyNamespace.on('connection', (socket) => {
  console.log('Proxy server has connected with me')
})

serverNamespace.on('connection', (socket) => {
  console.log('a server has connected with me')

  socket.on('disconnect', () => {
    console.log('a server just disconnected')
  })

  socket.on('update_directory', (structure) => {
    dir_structure = JSON.parse(structure)
    fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure, 'utf8', () => {
      console.log('directory structure updated successfully')
    })
  })

  socket.on('replicate', (fileName, path) => {
    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)
    let current_directory = directory_array[directory_array.length - 1]
    let mappingName = services.generateFileName()
    fs.writeFile(mappingName, '', 'utf8', () => {
      console.log('file', fileName, 'created successfully')
      current_directory.contents[fileName].mappings[process.argv[2]] = { name: mappingName, version: 1 }

      let structure_string = JSON.stringify(dir_structure, null, 4)
      fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
        console.log('directory structure updated successfully')
      })

      for(let i = 0; i < server_names.length; i++) {
        buddies[server_names[i]].emit('update_replicate', fileName, path, process.argv[2], { name: mappingName, version: 1 })
      }
    })
  })

  socket.on('update_replicate', (fileName, path, serverNo, mapping) => {
    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)
    let current_directory = directory_array[directory_array.length - 1]

    current_directory.contents[fileName].mappings[serverNo] = mapping

    let structure_string = JSON.stringify(dir_structure, null, 4)
    fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
      console.log('directory structure updated successfully')
    })
  })

  socket.on('update_file', (data, fileName, currentPath) => {
    let directory_array = services.getCurrentDirectory(dir_structure, currentPath, socket)
    let current_directory = directory_array[directory_array.length - 1]

    let local_name = current_directory.contents[fileName].mappings[process.argv[2]].name
    fs.writeFile(local_name, data, 'utf8', () => {
      let version = ++current_directory.contents[fileName].mappings[process.argv[2]].version
      console.log(version)
      let structure_string = JSON.stringify(dir_structure, null, 4)
      fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
        console.log('directory structure updated successfully')

        for(let i = 0; i < server_names.length; i++) {
          buddies[server_names[i]].emit('increment_version', fileName, currentPath, version, process.argv[2])
        }
      })
    })
  })

  socket.on('increment_version', (fileName, currentPath, version, serverNumber) => {
    let directory_array = services.getCurrentDirectory(dir_structure, currentPath, socket)
    let current_directory = directory_array[directory_array.length - 1]
    console.log(fileName)
    current_directory.contents[fileName].mappings[serverNumber].version = version

    let structure_string = JSON.stringify(dir_structure, null, 4)
    fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
      console.log('directory structure updated successfully')
    })
  })

  

})



for(let i = 0; i < config.servers.length; i++){
  if (i != process.argv[2]) {
    buddies[i] = io_client.connect(`http://${config.servers[i].ip}:${config.servers[i].port}/server`)
  }
}

server_names = Object.keys(buddies)

clientNamespace.on('connection', (socket) => {
  console.log('a client has connected with me')

  client_count++

  proxyNamespace.emit('client_change', process.argv[2], client_count)
  
  socket.on('disconnect', () => {
    console.log('a client just disconnected')
    client_count--
    proxyNamespace.emit('client_change', process.argv[2], client_count)
  })

  socket.on('open', (fileName, currentPath) => {
    let directory_array = services.getCurrentDirectory(dir_structure, currentPath, socket)
    let current_directory = directory_array[directory_array.length - 1]

    if (current_directory.contents[fileName] != null) {
      if(current_directory.contents[fileName].type == 'file') {
        if (current_directory.contents[fileName].mappings[process.argv[2]] != null) {
          let local_name = current_directory.contents[fileName].mappings[process.argv[2]].name
          fs.readFile(local_name, 'utf8', (err, data) => {
            if (err) {
              socket.emit('errors', 'The file is currently unavailable, please try again later.')
              return
            }
  
            socket.emit('open_response', data, fileName, currentPath)
            console.log(data)
          })
        } else {
          let server_found = false
          for (let i = 0; i < server_names.length && !server_found; i++) {
            if(current_directory.contents[fileName].mappings[server_names[i]]) {
              if(buddies[server_names[i]].connected) {
                socket.emit('redirect_request', config.servers[server_names[i]].ip, config.servers[server_names[i]].port, fileName, currentPath)
                server_found = true
              }
            }
          }
          if(!server_found) {
            socket.emit('errors', 'The requested file is currently unavailable, please try again later.')
          }
        }
      } else {
        socket.emit('errors', `${fileName} is not a file.`)
      }
    } else {
      socket.emit('errors', `No file with name ${fileName} exists.`)
    }

    
  })

  socket.on('save', (data, fileName, currentPath) => {
    let directory_array = services.getCurrentDirectory(dir_structure, currentPath, socket)
    let current_directory = directory_array[directory_array.length - 1]

    let local_name = current_directory.contents[fileName].mappings[process.argv[2]].name

    fs.writeFile(local_name, data, 'utf8', () => {
      console.log('file', fileName, 'updated successfully')
      let version = ++current_directory.contents[fileName].mappings[process.argv[2]].version
      let structure_string = JSON.stringify(dir_structure, null, 4)
      fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
        console.log('directory structure updated successfully')
      })

      for(let i = 0; i < server_names.length; i++) {
        buddies[server_names[i]].emit('increment_version', fileName, currentPath, version, process.argv[2])
      }

      let mapped_servers = Object.keys(current_directory.contents[fileName].mappings)
      for(let i = 0; i < mapped_servers.length; i++) {
        if(mapped_servers[i] != process.argv[2]) {
          buddies[mapped_servers[i]].emit('update_file', data, fileName, currentPath)
        }
      }

    })
  })

  socket.on('ls', (path) => {
    console.log(path)
    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)
    let current_directory = directory_array[directory_array.length - 1]
    console.log(current_directory.contents)
    let contents = Object.keys(current_directory.contents)
    let list = {'..': {type: 'folder'}}
    for (let i = 0; i < contents.length; i++) {
      list[contents[i]] = { type: current_directory.contents[contents[i]].type }
    }
    socket.emit('ls_reply', list)
  })

  socket.on('create', (fileName, path) => {
    if (fileName == '' || fileName.includes('/')) {
      socket.emit('errors', `Invalid directory name. Directory names cannot include '/' and cannot be empty strings.`)
      return null
    }

    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)
    let current_directory = directory_array[directory_array.length - 1]

    if (current_directory == null) {
      socket.emit('errors', 'Invalid directory path.')
      return null
    }
    
    if(current_directory.contents[fileName] != null) {
      socket.emit('errors', 'Entry with similar name exists')
      return null
    }
    let mappingName = services.generateFileName()
    fs.writeFile(mappingName, '', 'utf8', () => {
      console.log('file', fileName, 'created successfully')
      current_directory.contents[fileName] = {type: 'file', name: fileName, mappings: {[process.argv[2]]: { name: mappingName, version: 1 } } }
      let structure_string = JSON.stringify(dir_structure, null, 4)
      fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
        console.log('directory structure updated successfully')
      })

      for(let i = 0; i < server_names.length; i++) {
        buddies[server_names[i]].emit('update_directory', structure_string)
      }

      let dot_split = fileName.split('.')
      let replications = config.replications[dot_split[dot_split.length - 1]]
      if (replications != null) {
        for(let i = 0; i < replications - 1 && i < server_names.length; i++) {
          buddies[server_names[i]].emit('replicate', fileName, path)
        }
      }

      socket.emit('success', `File ${fileName} successfully created.`)
    })

    

  })

  socket.on('cd', (path, currentPath) => {
    console.log(currentPath)
    let directory_array = services.traversePath(dir_structure, path, currentPath, socket)
    console.log(directory_array)
    let final_path = '/'
    if(directory_array != null) {
      for (let i = 1; i < directory_array.length; i++) {
        if(i == directory_array.length - 1) {
          final_path += directory_array[i].name
        } else {
          final_path += directory_array[i].name + '/'
        }
      }
      console.log(final_path)
      socket.emit('cd_reply', final_path)
    }

  })

  socket.on('mkdir', (folderName, path) => {
    if (folderName == '' || folderName.includes('/')) {
      socket.emit('errors', `Invalid directory name. Directory names cannot include '/' and cannot be empty strings.`)
      return null
    }

    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)

    console.log(directory_array)
    let current_directory = directory_array[directory_array.length - 1]

    if (current_directory == null) {
      return null
    }
    
    if(current_directory.contents[folderName] != null) {
      socket.emit('errors', 'Entry with similar name exists')
      return null
    }
        

    current_directory.contents[folderName] = {type: 'folder', name: folderName, contents: {}}
    socket.emit('success', `Directory ${folderName} successfully created.`)

    let structure_string = JSON.stringify(dir_structure, null, 4)
    console.log(structure_string)
    fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
      console.log('directory structure updated successfully')
    })

    
    for(let i = 0; i < server_names.length; i++) {
      buddies[server_names[i]].emit('update_directory', structure_string)
    }
  })

  socket.on('upload', (fileName, data, path) => {
    let directory_array = services.getCurrentDirectory(dir_structure, path, socket)
    let current_directory = directory_array[directory_array.length - 1]

    if (current_directory == null) {
      socket.emit('errors', 'Invalid directory path.')
      return null
    }

    if(current_directory.contents[fileName] != null) {
      socket.emit('errors', 'Entry with similar name exists')
      return null
    }

    let mappingName = services.generateFileName()

    fs.writeFile(mappingName, data, 'utf8', () => {
      console.log('file', fileName, 'created successfully')
      current_directory.contents[fileName] = {type: 'file', name: fileName, mappings: {[process.argv[2]]: { name: mappingName, version: 1 } } }
      let structure_string = JSON.stringify(dir_structure, null, 4)
      fs.writeFile(`.${config.servers[process.argv[2]].dir_structure}.json`, structure_string, 'utf8', () => {
        console.log('directory structure updated successfully')
      })

      for(let i = 0; i < server_names.length; i++) {
        buddies[server_names[i]].emit('update_directory', structure_string)
      }

      let dot_split = fileName.split('.')
      let replications = config.replications[dot_split[dot_split.length - 1]]
      if (replications != null) {
        for(let i = 0; i < replications - 1 && i < server_names.length; i++) {
          buddies[server_names[i]].emit('replicate', fileName, path)
        }
      }

      socket.emit('success', `File ${fileName} successfully created.`)
    })
  })

  socket.on('rmdir', (folderName, path) => {
    
  })

})






