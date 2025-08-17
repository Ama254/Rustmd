#!/usr/bin/env bash
set -e

(
  $HOME/.cargo/bin/cargo build --target wasm32-unknown-unknown --release
  $HOME/.cargo/bin/wasm-bindgen target/wasm32-unknown-unknown/release/archive.wasm \
      --out-dir pkg \
      --target web \
      --no-typescript \
      --out-name archive
) > buildlog.txt 2>&1