function getCurrentDirectory(dir_structure, path, socket) {
    let folders = path.split('/')
    let directory_array = [dir_structure]
    console.log(folders)
    for (let i = 1; i < folders.length; i++) {
      console.log('Folder: ',folders[i])
      if (folders[i] != '') {
        if (dir_structure.contents[folders[i]] != null) {
          if (dir_structure.contents[folders[i]].type == 'folder') {
            directory_array.push(dir_structure.contents[folders[i]])
            dir_structure = dir_structure.contents[folders[i]]
          } else {
            socket.emit('errors', `No such directory ${folders[i]}`)
            return null
          }
        } else {
          socket.emit('errors', `No such entry ${folders[i]}`)
          return null
        }
      }
    }

    return directory_array
}

function traversePath(dir_structure, path, current_path, socket) {
  

  let directories = path.split('/')
  let directory_array = getCurrentDirectory(dir_structure, current_path, socket)
  console.log(directories)
  console.log(directory_array)

  if (directory_array == null) {
    return null
  }

  for (let i = 0; i < directories.length; i++) {
    if (directories[i] == '..') {
      if (directory_array.length > 0) {
        directory_array.splice(-1,1)
      } else {
        socket.emit('errors', `Invalid path ${path}`)
        return null
      }
    } else {
      if (directory_array[directory_array.length - 1].contents[directories[i]] != null) {
        if (directory_array[directory_array.length - 1].contents[directories[i]].type == 'folder') {
          console.log('hi')
          directory_array.push(directory_array[directory_array.length - 1].contents[directories[i]])
        } else {
          socket.emit('errors', `No such directory ${directories[i]}`)
          return null
        }
      } else {
        socket.emit('errors', `No such entry ${directories[i]}`)
        return null
      }
    }
  }

  return directory_array
}

function generateFileName() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++)
    text = text + possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

module.exports = {
  getCurrentDirectory,
  generateFileName,
  traversePath
}