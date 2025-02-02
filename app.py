from flask import Flask, render_template, request, redirect, url_for, send_from_directory, abort, jsonify
import os
import shutil

app = Flask(__name__)
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def get_safe_path(relative_path):
    base_path = os.path.abspath(app.config['UPLOAD_FOLDER'])
    safe_path = os.path.abspath(os.path.join(base_path, relative_path))
    if not safe_path.startswith(base_path):
        raise ValueError("Unsafe path")
    return safe_path

# Redirect root to browse root folder
@app.route('/')
def index():
    return redirect(url_for('browse', subpath=''))

# Browse route to display folder contents
@app.route('/browse/', defaults={'subpath': ''})
@app.route('/browse/<path:subpath>')
def browse(subpath):
    try:
        _ = get_safe_path(subpath)
    except Exception as e:
        return abort(404)
    return render_template('index.html', current_path=subpath)

# Return files and folders in the specified directory as JSON
@app.route('/files')
def get_files():
    rel_path = request.args.get("path", "")
    try:
        base_dir = get_safe_path(rel_path)
    except Exception as e:
        return jsonify({'error': 'Invalid path'}), 400
    items = os.listdir(base_dir)
    files_info = []
    for item in items:
        item_path = os.path.join(base_dir, item)
        if os.path.isdir(item_path):
            item_type = "folder"
        else:
            item_type = "file"
        # Return relative path for each item
        item_rel_path = os.path.join(rel_path, item) if rel_path else item
        files_info.append({'name': item, 'type': item_type, 'path': item_rel_path})
    return jsonify(files_info)

# File download route (for files only)
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return abort(404)
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# File upload route (uploads into current folder)
@app.route('/upload', methods=['POST'])
def upload():
    rel_path = request.args.get("path", "")
    try:
        target_dir = get_safe_path(rel_path)
    except Exception as e:
        return jsonify({'error': 'Invalid target directory'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    files = request.files.getlist('file')
    if not files:
        return jsonify({'error': 'No selected file'}), 400

    uploaded_files = []
    for file in files:
        if file.filename != '':
            filepath = os.path.join(target_dir, file.filename)
            file.save(filepath)
            uploaded_files.append(file.filename)
    if uploaded_files:
        return jsonify({'success': True, 'filenames': uploaded_files}), 200
    else:
        return jsonify({'error': 'No selected file'}), 400

# Delete file or folder route
@app.route('/delete_item', methods=['POST'])
def delete_item():
    data = request.get_json()
    if not data or 'path' not in data:
        return jsonify({'error': 'Missing path'}), 400
    try:
        path = get_safe_path(data['path'])
        if os.path.isfile(path):
            os.remove(path)
        elif os.path.isdir(path):
            shutil.rmtree(path)
        else:
            return jsonify({'error': 'Item does not exist'}), 404
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create folder route
@app.route('/create_folder', methods=['POST'])
def create_folder():
    data = request.get_json()
    if not data or 'folder' not in data:
        return jsonify({'error': 'Missing folder name'}), 400
    try:
        folder_path = get_safe_path(data['folder'])
        os.makedirs(folder_path, exist_ok=True)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Move item route (move file or folder)
@app.route('/move_item', methods=['POST'])
def move_item():
    data = request.get_json()
    if not data or 'source' not in data or 'destination' not in data:
        return jsonify({'error': 'Missing source or destination'}), 400
    try:
        src = get_safe_path(data['source'])
        dest = get_safe_path(data['destination'])
        # Use os.rename for a simple move (without recursive directory creation)
        os.rename(src, dest)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rename item route
@app.route('/rename_item', methods=['POST'])
def rename_item():
    data = request.get_json()
    if not data or 'old_name' not in data or 'new_name' not in data:
        return jsonify({'error': 'Missing old_name or new_name'}), 400
    try:
        base = os.path.abspath(app.config['UPLOAD_FOLDER'])
        old_path = get_safe_path(data['old_name'])
        new_path = os.path.abspath(os.path.join(os.path.dirname(old_path), data['new_name']))
        if not new_path.startswith(base):
            return jsonify({'error': 'Unsafe new name'}), 400
        os.rename(old_path, new_path)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True, host='0.0.0.0')
