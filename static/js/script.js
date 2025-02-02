let selectedFiles = [];
let hoverTimeout;

// Function to display file preview
function previewFile(filename) {
  hoverTimeout = setTimeout(() => {
    const previewPopup = document.getElementById('preview-popup');
    const previewContent = document.getElementById('preview-content');
    
    previewContent.innerHTML = 'Loading preview...';
    if (filename.endsWith('.txt')) {
      fetch(`/uploads/${filename}`)
        .then(response => response.text())
        .then(text => previewContent.textContent = text)
        .catch(err => {
          console.error('Error fetching file:', err);
          previewContent.textContent = 'Error loading preview.';
        });
    } else if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      const img = document.createElement('img');
      img.src = `/uploads/${filename}`;
      img.alt = filename;
      img.onload = () => {
        previewContent.innerHTML = '';
        previewContent.appendChild(img);
      };
      img.onerror = () => {
        previewContent.textContent = 'Error loading image preview.';
      };
    } else {
      previewContent.textContent = 'Preview not available for this file type.';
    }
    previewPopup.style.display = 'block';
  }, 1000);
}

function hidePreview() {
  clearTimeout(hoverTimeout);
  document.getElementById('preview-popup').style.display = 'none';
}

// Add new files to the selectedFiles array
function handleFiles(newFiles) {
  for (const file of newFiles) {
    selectedFiles.push(file);
  }
  updateFilesList();
}

// Update the UI list of selected files
function updateFilesList() {
  const selectedFilesList = document.getElementById('selected-files-list');
  selectedFilesList.innerHTML = '';
  if (selectedFiles.length > 0) {
    document.getElementById('upload-btn').style.display = 'inline-block';
  } else {
    document.getElementById('upload-btn').style.display = 'none';
  }
  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => {
      selectedFiles.splice(index, 1);
      updateFilesList();
    };
    li.appendChild(removeBtn);
    selectedFilesList.appendChild(li);
  });
}

// Drag & Drop events and file input handling
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('upload-btn');

fileInput.addEventListener('change', (event) => {
  handleFiles(event.target.files);
  fileInput.value = '';
});

dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  handleFiles(event.dataTransfer.files);
});

dropArea.addEventListener('dragover', (event) => {
  event.preventDefault();
});

// Upload files with a loading indicator
uploadBtn.addEventListener('click', () => {
  if (selectedFiles.length === 0) return;
  const formData = new FormData();
  selectedFiles.forEach(file => {
    formData.append('file', file);
  });
  const loadingIndicator = document.getElementById('loadingIndicator');
  loadingIndicator.style.display = 'block';
  uploadBtn.disabled = true;
  fetch(`/upload?path=${encodeURIComponent(currentPath)}`, {
    method: 'POST',
    body: formData
  })
  .then(response => {
    loadingIndicator.style.display = 'none';
    uploadBtn.disabled = false;
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Upload failed');
    }
  })
  .then(result => {
    console.log('Files uploaded successfully:', result);
    selectedFiles = [];
    updateFilesList();
    loadFiles();
  })
  .catch(error => {
    loadingIndicator.style.display = 'none';
    uploadBtn.disabled = false;
    console.error('Error uploading files:', error);
  });
});

// Refresh file list on clicking the refresh button
document.getElementById('refresh-btn').addEventListener('click', loadFiles);

document.getElementById('create-folder-btn').addEventListener('click', () => {
    const folderName = document.getElementById('new-folder-name').value.trim();
    if (!folderName) {
      alert("Please enter a folder name.");
      return;
    }
    // Create folder in the current directory
    const newFolderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetch('/create_folder', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({folder: newFolderPath})
    })
    .then(response => response.json())
    .then(result => {
      console.log('Folder creation result:', result);
      document.getElementById('new-folder-name').value = '';
      loadFiles();
    })
    .catch(err => console.error('Error creating folder:', err));
  });

// Load files from the server and display them
function loadFiles() {
  fetch(`/files?path=${encodeURIComponent(currentPath)}`)
    .then(response => response.json())
    .then(items => {
      const fileList = document.getElementById('file-list');
      fileList.innerHTML = '';

      // If not in root, add ".." for parent folder navigation and as drop target
      if (currentPath) {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.textContent = '.. [Parent]';
        li.onclick = () => {
          const parts = currentPath.split('/');
          parts.pop();
          const parentPath = parts.join('/');
          window.location.href = `/browse/${parentPath}`;
        };
        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          li.style.backgroundColor = "#666";
        });
        li.addEventListener('dragleave', (e) => {
          li.style.backgroundColor = "";
        });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            li.style.backgroundColor = "";
            const data = e.dataTransfer.getData("text/plain");
            console.log("Dropped data:", data);
            if (data) {
              let parts = data.split("/");
              let fileName = parts.pop();
              let parentParts = currentPath.split('/');
              parentParts.pop();
              let destination = (parentParts.join('/') ? parentParts.join('/') + "/" : "") + fileName;
              moveItemDirect(data, destination)
                .then(() => {
                  // After moving the file, navigate to the parent folder
                  const newPath = parentParts.join('/');
                  window.location.href = `/browse/${newPath}`;
                });
            }
          });
        fileList.appendChild(li);
      }

      items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'file-item';
        if (item.type === 'folder') {
          li.textContent = item.name + ' [Folder]';
          li.onclick = () => {
            const newPath = currentPath ? currentPath + "/" + item.name : item.name;
            window.location.href = `/browse/${newPath}`;
          };
          // Add dragover/drop events to allow dropping files into folder
          li.addEventListener('dragover', (e) => {
            e.preventDefault();
            li.style.backgroundColor = "#666";
          });
          li.addEventListener('dragleave', (e) => {
            li.style.backgroundColor = "";
          });
          li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.style.backgroundColor = "";
            const data = e.dataTransfer.getData("text/plain");
            if (data) {
              let parts = data.split("/");
              let fileName = parts.pop();
              let destination = currentPath ? currentPath + "/" + item.name + "/" + fileName : item.name + "/" + fileName;
              moveItemDirect(data, destination);
            }
          });
        } else {
          li.textContent = item.name;
          li.setAttribute('draggable', true);
          li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("text/plain", item.path);
          });
          li.onclick = () => {
            window.location.href = `/uploads/${item.path}`;
          };
        }
        // Action buttons for delete, rename, and move (prompt version)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteItem(item.path);
        };

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.className = 'rename';
        renameBtn.onclick = (e) => {
          e.stopPropagation();
          renameItem(item.path);
        };

        const moveBtn = document.createElement('button');
        moveBtn.textContent = 'Move';
        moveBtn.className = 'move';
        moveBtn.onclick = (e) => {
          e.stopPropagation();
          const destFolder = prompt("Enter destination folder for " + item.name);
          if (destFolder !== null) {
            let parts = item.path.split("/");
            let fileName = parts.pop();
            let destination = currentPath ? currentPath + "/" + destFolder + "/" + fileName : destFolder + "/" + fileName;
            moveItemDirect(item.path, destination);
          }
        };

        actionsDiv.appendChild(deleteBtn);
        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(moveBtn);
        li.appendChild(actionsDiv);

        fileList.appendChild(li);
      });
    })
    .catch(err => console.error('Error fetching file list:', err));
}

// Delete item function
function deleteItem(itemPath) {
  if (!confirm(`Are you sure you want to delete ${itemPath}?`)) return;
  fetch('/delete_item', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path: itemPath})
  })
  .then(response => response.json())
  .then(result => {
    console.log('Delete result:', result);
    loadFiles();
  })
  .catch(err => console.error('Error deleting item:', err));
}

// Rename item function
function renameItem(itemPath) {
  const newName = prompt("Enter new name for " + itemPath);
  if (!newName) return;
  fetch('/rename_item', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({old_name: itemPath, new_name: newName})
  })
  .then(response => response.json())
  .then(result => {
    console.log('Rename result:', result);
    loadFiles();
  })
  .catch(err => console.error('Error renaming item:', err));
}

// Move item function using drag & drop or prompt
function moveItemDirect(source, destination) {
    return fetch('/move_item', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({source: source, destination: destination})
    })
    .then(response => response.json())
    .then(result => {
      console.log('Move result:', result);
      return result;
    })
    .catch(err => {
      console.error('Error moving item:', err);
      throw err;
    });
  }

// Load files when the page loads
document.addEventListener('DOMContentLoaded', loadFiles);
