(
  cargo build --target wasm32-unknown-unknown --release &&
  wasm-bindgen target/wasm32-unknown-unknown/release/your_crate_name.wasm \
    --out-dir pkg \
    --target web \
    --no-typescript \
    --out-name archive
) > buildlog.txt 2>&1