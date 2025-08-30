#!/bin/bash

# Exit on any error
set -e

# Function to handle errors
handle_error() {
    echo "Error: $1 failed!"
    exit 1
}

echo "Installing npm dependencies..."
npm install || handle_error "npm install"

echo "Compiling the project..."
npm run compile || handle_error "npm run compile"

echo "Packaging the extension..."
vsce package || handle_error "vsce package"

echo "Installing the extension in VS Code..."
code --install-extension task-manager-0.0.1.vsix || handle_error "extension installation"

echo "Installation completed successfully!"

