(
  cargo build --target wasm32-unknown-unknown --release &&
  wasm-bindgen target/wasm32-unknown-unknown/release/wav.wasm \
    --out-dir pkg \
    --target web \
    --no-typescript \
    --out-name wav
) > buildlog.txt 2>&1

