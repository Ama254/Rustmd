cargo build --target wasm32-unknown-unknown --release > buildlog.txt 2>&1
wasm-bindgen --out-dir pkg --target web target/wasm32-unknown-unknown/release/enc.wasm >> buildlog.txt 2>&1