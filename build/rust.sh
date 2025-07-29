#!/bin/bash

set -e

echo "🔧 Installing Rust (if not already installed)..."
if ! command -v rustup >/dev/null 2>&1; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  export PATH="$HOME/.cargo/bin:$PATH"
else
  echo "✅ Rust is already installed."
fi
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
# Add Rust to PATH in shell profiles
echo "🛠️ Ensuring Rust is in your PATH..."
CARGO_PATH='export PATH="$HOME/.cargo/bin:$PATH"'

for file in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" "$HOME/.bash_profile"; do
  if [ -f "$file" ] && ! grep -qF "$CARGO_PATH" "$file"; then
    echo "$CARGO_PATH" >> "$file"
    echo "➕ Added Rust to $file"
  fi
done

# Special handling for Fish shell
if command -v fish >/dev/null 2>&1; then
  fish_config="$HOME/.config/fish/config.fish"
  if ! grep -q "$HOME/.cargo/bin" "$fish_config" 2>/dev/null; then
    echo "set -gx PATH \$HOME/.cargo/bin \$PATH" >> "$fish_config"
    echo "➕ Added Rust to Fish config"
  fi
fi

echo "🌐 Adding WebAssembly target..."
rustup target add wasm32-unknown-unknown

echo "📦 Installing wasm-bindgen CLI..."
cargo install wasm-bindgen-cli

echo "✅ Rust + wasm toolchain setup complete!"
echo "🧠 Restart your terminal or run: source ~/.bashrc (or relevant shell) to activate Rust."