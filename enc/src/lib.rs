#[allow(unused_imports)] // Allow unused imports explicitly
#[allow(dead_code)] // Allow dead code explicitly
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes128Gcm, Aes256Gcm,
    aead::generic_array::typenum::U12,
    aead::generic_array::GenericArray,
};
use argon2::{Argon2, Params};
#[allow(unused_imports)]
use pbkdf2::{
    pbkdf2_hmac_array,
    hmac::Hmac,
};
use sha2::Sha256;
use subtle::ConstantTimeEq;
use zeroize::{Zeroize, ZeroizeOnDrop};
use wasm_bindgen::prelude::*;
use js_sys::{Object, Reflect, Uint8Array};
use getrandom::getrandom;

#[derive(Debug)]
pub enum CryptoError {
    EncryptionFailed { code: u32, message: String },
    DecryptionFailed { code: u32, message: String },
    KeyDerivationFailed { code: u32, message: String },
    InvalidInput { code: u32, message: String },
    BatchOperationFailed { code: u32, message: String },
    NonceGenerationFailed { code: u32, message: String },
    ContextValidationFailed { code: u32, message: String },
}

#[wasm_bindgen]
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecureBytes(Vec<u8>);

#[wasm_bindgen]
#[derive(Clone, PartialEq)]
pub enum EncryptionAlgorithm {
    Aes256Gcm,
    Aes128Gcm,
}

#[wasm_bindgen]
#[derive(Clone, PartialEq)]
pub enum KdfAlgorithm {
    Argon2,
    Pbkdf2,
}

enum CipherVariant {
    Aes256(Aes256Gcm),
    Aes128(Aes128Gcm),
}

#[wasm_bindgen]
pub struct CryptoService {
    #[allow(dead_code)]
    algorithm: EncryptionAlgorithm,
    #[allow(dead_code)]
    kdf_algorithm: KdfAlgorithm,
    key_version: u32,
    #[wasm_bindgen(skip)]
    cipher: CipherVariant,
}

#[wasm_bindgen]
pub struct Config {
    kdf_time_cost: u32,
    kdf_mem_cost: u32,
    kdf_parallelism: u32,
    algorithm: EncryptionAlgorithm,
    kdf_algorithm: KdfAlgorithm,
    key_version: u32,
}

#[wasm_bindgen]
pub struct BatchResult {
    successes: Vec<Uint8Array>,
    errors: Vec<String>,
}

#[wasm_bindgen]
pub struct StreamState {
    #[wasm_bindgen(skip)]
    buffer: Vec<u8>,
    #[wasm_bindgen(skip)]
    nonce: GenericArray<u8, U12>,
    processed_bytes: u64,
}

#[wasm_bindgen]
impl BatchResult {
    #[wasm_bindgen(constructor)]
    pub fn new(successes: Vec<Uint8Array>, errors: Vec<String>) -> Self {
        BatchResult { successes, errors }
    }

    #[wasm_bindgen(getter)]
    pub fn successes(&self) -> Vec<Uint8Array> {
        self.successes.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn errors(&self) -> Vec<String> {
        self.errors.clone()
    }
}

#[wasm_bindgen]
impl Config {
    #[wasm_bindgen(constructor)]
    pub fn new(
        kdf_time_cost: u32,
        kdf_mem_cost: u32,
        kdf_parallelism: u32,
        algorithm: EncryptionAlgorithm,
        kdf_algorithm: KdfAlgorithm,
        key_version: u32,
    ) -> Self {
        Config {
            kdf_time_cost,
            kdf_mem_cost,
            kdf_parallelism,
            algorithm,
            kdf_algorithm,
            key_version,
        }
    }
}

#[wasm_bindgen]
impl SecureBytes {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Uint8Array) -> Self {
        Self(data.to_vec())
    }

    pub fn random(len: usize) -> Result<SecureBytes, JsValue> {
        let mut bytes = vec![0u8; len];
        getrandom(&mut bytes).map_err(|_| CryptoError::NonceGenerationFailed {
            code: 1001,
            message: "Random generation failed".to_string(),
        })?;
        Ok(SecureBytes(bytes))
    }

    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Uint8Array {
        Uint8Array::from(self.0.as_slice())
    }
}

#[wasm_bindgen]
impl StreamState {
    fn new(nonce: GenericArray<u8, U12>) -> Self {
        StreamState {
            buffer: Vec::new(),
            nonce,
            processed_bytes: 0,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn processed_bytes(&self) -> f64 {
        self.processed_bytes as f64
    }
}

#[wasm_bindgen]
impl CryptoService {
    #[wasm_bindgen(constructor)]
    pub fn new(master_key: Uint8Array, config: &Config) -> Result<CryptoService, JsValue> {
        let kdf_salt = SecureBytes::random(32)?;
        let aes_key = Self::derive_key(&master_key.to_vec(), &kdf_salt, b"aes_gcm_key", config)?;

        let cipher = match config.algorithm {
            EncryptionAlgorithm::Aes256Gcm => {
                let c = Aes256Gcm::new_from_slice(&aes_key.0)
                    .map_err(|_| CryptoError::KeyDerivationFailed {
                        code: 1002,
                        message: "Invalid AES-256 key length".to_string(),
                    })?;
                CipherVariant::Aes256(c)
            }
            EncryptionAlgorithm::Aes128Gcm => {
                let c = Aes128Gcm::new_from_slice(&aes_key.0)
                    .map_err(|_| CryptoError::KeyDerivationFailed {
                        code: 1003,
                        message: "Invalid AES-128 key length".to_string(),
                    })?;
                CipherVariant::Aes128(c)
            }
        };

        Ok(CryptoService {
            cipher,
            algorithm: config.algorithm.clone(),
            kdf_algorithm: config.kdf_algorithm.clone(),
            key_version: config.key_version,
        })
    }

    fn derive_key(
        master_key: &[u8],
        salt: &SecureBytes,
        _info: &[u8], // Note: info is unused in current implementation
        config: &Config,
    ) -> Result<SecureBytes, CryptoError> {
        let mut okm = [0u8; 32]; // Use array to match pbkdf2_hmac_array output
        match config.kdf_algorithm {
            KdfAlgorithm::Argon2 => {
                let params = Params::new(
                    config.kdf_mem_cost,
                    config.kdf_time_cost,
                    config.kdf_parallelism,
                    None,
                )
                .map_err(|_| CryptoError::KeyDerivationFailed {
                    code: 1005,
                    message: "Invalid Argon2 parameters".to_string(),
                })?;
                let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
                argon2
                    .hash_password_into(master_key, &salt.0, &mut okm)
                    .map_err(|_| CryptoError::KeyDerivationFailed {
                        code: 1006,
                        message: "Argon2 key derivation failed".to_string(),
                    })?;
            }
            KdfAlgorithm::Pbkdf2 => {
                okm = pbkdf2_hmac_array::<Sha256, 32>(
                    master_key,
                    &salt.0,
                    config.kdf_time_cost,
                );
            }
        }
        Ok(SecureBytes(okm.to_vec())) // Convert array to Vec<u8> for SecureBytes
    }

    #[wasm_bindgen]
    pub fn encrypt(
        &self,
        data: Uint8Array,
        context: Uint8Array,
        aad: Option<Uint8Array>,
    ) -> Result<Uint8Array, JsValue> {
        let nonce = Self::generate_nonce()?;
        let input = [data.to_vec(), context.to_vec()].concat();
        let payload = match aad {
            Some(aad) => Payload {
                msg: &input,
                aad: &aad.to_vec(),
            },
            None => Payload {
                msg: &input,
                aad: &[],
            },
        };

        let mut ciphertext = match &self.cipher {
            CipherVariant::Aes256(c) => c.encrypt(&nonce, payload),
            CipherVariant::Aes128(c) => c.encrypt(&nonce, payload),
        }
        .map_err(|_| CryptoError::EncryptionFailed {
            code: 1007,
            message: "Encryption operation failed".to_string(),
        })?;

        ciphertext.splice(0..0, nonce.iter().cloned());
        ciphertext.splice(0..0, vec![self.key_version as u8]);
        Ok(Uint8Array::from(ciphertext.as_slice()))
    }

    #[wasm_bindgen]
    pub fn decrypt(
        &self,
        ciphertext: Uint8Array,
        context: Uint8Array,
        aad: Option<Uint8Array>,
    ) -> Result<Uint8Array, JsValue> {
        let ciphertext = ciphertext.to_vec();
        if ciphertext.len() < 13 {
            return Err(CryptoError::InvalidInput {
                code: 1008,
                message: "Invalid ciphertext length".to_string(),
            }.into());
        }

        let version = ciphertext[0] as u32;
        if version != self.key_version {
            return Err(CryptoError::InvalidInput {
                code: 1009,
                message: format!("Key version mismatch: expected {}, got {}", self.key_version, version),
            }.into());
        }

        let nonce = GenericArray::<u8, U12>::from_slice(&ciphertext[1..13]);
        let payload = match aad {
            Some(aad) => Payload {
                msg: &ciphertext[13..],
                aad: &aad.to_vec(),
            },
            None => Payload {
                msg: &ciphertext[13..],
                aad: &[],
            },
        };

        let plaintext = match &self.cipher {
            CipherVariant::Aes256(c) => c.decrypt(nonce, payload),
            CipherVariant::Aes128(c) => c.decrypt(nonce, payload),
        }
        .map_err(|_| CryptoError::DecryptionFailed {
            code: 1010,
            message: "Decryption operation failed".to_string(),
        })?;

        if plaintext.len() <= context.length() as usize {
            return Err(CryptoError::InvalidInput {
                code: 1011,
                message: "Invalid plaintext length".to_string(),
            }.into());
        }

        let (data_part, ctx_part) = plaintext.split_at(plaintext.len() - context.length() as usize);
        if !bool::from(ctx_part.ct_eq(&context.to_vec())) {
            return Err(CryptoError::ContextValidationFailed {
                code: 1012,
                message: "Context mismatch".to_string(),
            }.into());
        }

        Ok(Uint8Array::from(data_part))
    }

    #[wasm_bindgen]
    pub fn batch_encrypt(
        &self,
        data_items: Vec<JsValue>,
        context: Uint8Array,
        aad: Option<Uint8Array>,
        progress_callback: Option<js_sys::Function>,
        max_memory_bytes: Option<u32>,
    ) -> Result<BatchResult, JsValue> {
        let data_items: Vec<Uint8Array> = data_items
            .into_iter()
            .map(|js_val| {
                js_val
                    .dyn_into::<Uint8Array>()
                    .map_err(|_| CryptoError::InvalidInput {
                        code: 1013,
                        message: "Expected Uint8Array".to_string(),
                    })
            })
            .collect::<Result<Vec<Uint8Array>, CryptoError>>()?;

        let total_bytes: u64 = data_items.iter().map(|data| data.length() as u64).sum();
        if let Some(max_bytes) = max_memory_bytes {
            if total_bytes > max_bytes as u64 {
                return Err(CryptoError::BatchOperationFailed {
                    code: 1014,
                    message: format!("Input size {} exceeds max memory limit {}", total_bytes, max_bytes),
                }.into());
            }
        }

        let mut processed_bytes: u64 = 0;
        let mut successes = Vec::with_capacity(data_items.len());
        let mut errors = Vec::new();

        for (index, data) in data_items.into_iter().enumerate() {
            match self.encrypt(data.clone(), context.clone(), aad.clone()) {
                Ok(ciphertext) => {
                    processed_bytes += data.length() as u64;
                    successes.push(ciphertext);
                }
                Err(e) => {
                    processed_bytes += data.length() as u64;
                    errors.push(format!("Item {}: {}", index, e.as_string().unwrap_or("Unknown error".to_string())));
                }
            }

            if let Some(callback) = &progress_callback {
                let progress = if total_bytes > 0 {
                    (processed_bytes as f64 / total_bytes as f64) * 100.0
                } else {
                    100.0
                };
                let this = &JsValue::NULL;
                let _ = callback.call1(this, &JsValue::from_f64(progress))
                    .map_err(|_| CryptoError::BatchOperationFailed {
                        code: 1015,
                        message: "Progress callback failed".to_string(),
                    })?;
            }
        }

        if let Some(callback) = &progress_callback {
            let this = &JsValue::NULL;
            let _ = callback.call1(this, &JsValue::from_f64(100.0))
                .map_err(|_| CryptoError::BatchOperationFailed {
                    code: 1016,
                    message: "Final progress callback failed".to_string(),
                })?;
        }

        Ok(BatchResult::new(successes, errors))
    }

    #[wasm_bindgen]
    pub fn batch_decrypt(
        &self,
        ciphertexts: Vec<JsValue>,
        context: Uint8Array,
        aad: Option<Uint8Array>,
        progress_callback: Option<js_sys::Function>,
        max_memory_bytes: Option<u32>,
    ) -> Result<BatchResult, JsValue> {
        let ciphertexts: Vec<Uint8Array> = ciphertexts
            .into_iter()
            .map(|js_val| {
                js_val
                    .dyn_into::<Uint8Array>()
                    .map_err(|_| CryptoError::InvalidInput {
                        code: 1017,
                        message: "Expected Uint8Array".to_string(),
                    })
            })
            .collect::<Result<Vec<Uint8Array>, CryptoError>>()?;

        let total_bytes: u64 = ciphertexts.iter().map(|data| data.length() as u64).sum();
        if let Some(max_bytes) = max_memory_bytes {
            if total_bytes > max_bytes as u64 {
                return Err(CryptoError::BatchOperationFailed {
                    code: 1018,
                    message: format!("Input size {} exceeds max memory limit {}", total_bytes, max_bytes),
                }.into());
            }
        }

        let mut processed_bytes: u64 = 0;
        let mut successes = Vec::with_capacity(ciphertexts.len());
        let mut errors = Vec::new();

        for (index, ciphertext) in ciphertexts.into_iter().enumerate() {
            match self.decrypt(ciphertext.clone(), context.clone(), aad.clone()) {
                Ok(plaintext) => {
                    processed_bytes += ciphertext.length() as u64;
                    successes.push(plaintext);
                }
                Err(e) => {
                    processed_bytes += ciphertext.length() as u64;
                    errors.push(format!("Item {}: {}", index, e.as_string().unwrap_or("Unknown error".to_string())));
                }
            }

            if let Some(callback) = &progress_callback {
                let progress = if total_bytes > 0 {
                    (processed_bytes as f64 / total_bytes as f64) * 100.0
                } else {
                    100.0
                };
                let this = &JsValue::NULL;
                let _ = callback.call1(this, &JsValue::from_f64(progress))
                    .map_err(|_| CryptoError::BatchOperationFailed {
                        code: 1019,
                        message: "Progress callback failed".to_string(),
                    })?;
            }
        }

        if let Some(callback) = &progress_callback {
            let this = &JsValue::NULL;
            let _ = callback.call1(this, &JsValue::from_f64(100.0))
                .map_err(|_| CryptoError::BatchOperationFailed {
                    code: 1020,
                    message: "Final progress callback failed".to_string(),
                })?;
        }

        Ok(BatchResult::new(successes, errors))
    }

    #[wasm_bindgen]
    pub fn init_stream_encrypt(&self) -> Result<StreamState, JsValue> {
        let nonce = Self::generate_nonce()?;
        Ok(StreamState::new(nonce))
    }

    #[wasm_bindgen]
    pub fn stream_encrypt_chunk(
        &self,
        state: &mut StreamState,
        data: Uint8Array,
        context: Uint8Array,
        aad: Option<Uint8Array>,
        is_final: bool,
        progress_callback: Option<js_sys::Function>,
    ) -> Result<Uint8Array, JsValue> {
        state.buffer.extend_from_slice(&data.to_vec());
        state.processed_bytes += data.length() as u64;

        if let Some(callback) = &progress_callback {
            let this = &JsValue::NULL;
            let _ = callback.call1(this, &JsValue::from_f64(state.processed_bytes as f64))
                .map_err(|_| CryptoError::BatchOperationFailed {
                    code: 1021,
                    message: "Progress callback failed".to_string(),
                })?;
        }

        if !is_final {
            return Ok(Uint8Array::new_with_length(0));
        }

        let input = [state.buffer.as_slice(), context.to_vec().as_slice()].concat();
        let payload = match aad {
            Some(aad) => Payload {
                msg: &input,
                aad: &aad.to_vec(),
            },
            None => Payload {
                msg: &input,
                aad: &[],
            },
        };

        let mut ciphertext = match &self.cipher {
            CipherVariant::Aes256(c) => c.encrypt(&state.nonce, payload),
            CipherVariant::Aes128(c) => c.encrypt(&state.nonce, payload),
        }
        .map_err(|_| CryptoError::EncryptionFailed {
            code: 1022,
            message: "Stream encryption failed".to_string(),
        })?;

        ciphertext.splice(0..0, state.nonce.iter().cloned());
        ciphertext.splice(0..0, vec![self.key_version as u8]);
        state.buffer.zeroize();
        Ok(Uint8Array::from(ciphertext.as_slice()))
    }

    #[wasm_bindgen]
    pub fn estimate_encrypted_size(&self, input_size: u32) -> u32 {
        input_size + 12 + 16 + 1 // nonce (12) + tag (16) + version (1)
    }

    fn generate_nonce() -> Result<GenericArray<u8, U12>, CryptoError> {
        let mut nonce = [0u8; 12];
        getrandom(&mut nonce).map_err(|_| CryptoError::NonceGenerationFailed {
            code: 1023,
            message: "Nonce generation failed".to_string(),
        })?;
        Ok(GenericArray::clone_from_slice(&nonce))
    }
}

impl From<CryptoError> for JsValue {
    fn from(err: CryptoError) -> Self {
        let (code, message) = match err {
            CryptoError::EncryptionFailed { code, message } => (code, message),
            CryptoError::DecryptionFailed { code, message } => (code, message),
            CryptoError::KeyDerivationFailed { code, message } => (code, message),
            CryptoError::InvalidInput { code, message } => (code, message),
            CryptoError::BatchOperationFailed { code, message } => (code, message),
            CryptoError::NonceGenerationFailed { code, message } => (code, message),
            CryptoError::ContextValidationFailed { code, message } => (code, message),
        };
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("code"), &JsValue::from(code)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("message"), &JsValue::from_str(&message)).unwrap();
        obj.into()
    }
}