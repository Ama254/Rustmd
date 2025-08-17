use std::io::{self, BufRead, Read, Write, Cursor};
use std::error::Error as StdError;
use std::fmt;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use flate2::{Compression, GzBuilder};
use flate2::read::{DeflateDecoder as FlateDeflateDecoder, GzDecoder as FlateGzDecoder, ZlibDecoder as FlateZlibDecoder};
use flate2::write::{DeflateEncoder as FlateDeflateEncoder, GzEncoder as FlateGzEncoder, ZlibEncoder as FlateZlibEncoder};
use js_sys::{Date, Function, Object, Reflect, Uint8Array};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{AbortSignal, Blob, BlobPropertyBag, ReadableStream, ReadableStreamDefaultReader};
use brotli::enc::BrotliEncoderParams;
use brotli::{CompressorWriter as BrotliCompressorWriter, Decompressor as BrotliDecompressor};
use zip::{ZipWriter, ZipArchive, write::FileOptions, CompressionMethod as ZipCompressionMethod};
use crypt_::{CryptoService, Config, SecureBytes, CryptoError};
use bytes::{Bytes, BytesMut};

mod crypt_;
#[allow(dead_code)]
const DEFAULT_CHUNK_SIZE: usize = 64 * 1024;
const MAX_MEMORY_LIMIT: usize = 256 * 1024 * 1024;
#[allow(dead_code)]
const MIN_COMPRESSION_LEVEL: i32 = -7;
#[allow(dead_code)]
const MAX_COMPRESSION_LEVEL: i32 = 22;

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub enum CompressionAlgorithm {
    Gzip,
    Deflate,
    Zlib,
    Brotli,
    None,
}

#[wasm_bindgen]
pub enum ArchiveFormat {
    None,
    Zip,
}

#[derive(Debug)]
pub enum ArchiveError {
    InvalidChunkSize { code: u32, message: String },
    InvalidCompressionLevel { code: u32, message: String },
    UnsupportedAlgorithm { code: u32, message: String },
    OperationAborted { code: u32, message: String },
    IoError { code: u32, message: String },
    EncryptionError { code: u32, message: String },
    ChecksumMismatch { code: u32, message: String },
    InvalidMasterKey { code: u32, message: String },
    MemoryLimitExceeded { code: u32, message: String },
    InvalidPreset { code: u32, message: String },
    InvalidInput { code: u32, message: String },
    CorruptedData { code: u32, message: String },
    UnsupportedFeature { code: u32, message: String },
    InvalidArchiveFormat { code: u32, message: String },
    ParallelProcessingUnavailable { code: u32, message: String },
    DictionaryError { code: u32, message: String },
    StreamError { code: u32, message: String },
}

impl fmt::Display for ArchiveError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ArchiveError::InvalidChunkSize { message, .. } => write!(f, "{}", message),
            ArchiveError::InvalidCompressionLevel { message, .. } => write!(f, "{}", message),
            ArchiveError::UnsupportedAlgorithm { message, .. } => write!(f, "{}", message),
            ArchiveError::OperationAborted { message, .. } => write!(f, "{}", message),
            ArchiveError::IoError { message, .. } => write!(f, "{}", message),
            ArchiveError::EncryptionError { message, .. } => write!(f, "{}", message),
            ArchiveError::ChecksumMismatch { message, .. } => write!(f, "{}", message),
            ArchiveError::InvalidMasterKey { message, .. } => write!(f, "{}", message),
            ArchiveError::MemoryLimitExceeded { message, .. } => write!(f, "{}", message),
            ArchiveError::InvalidPreset { message, .. } => write!(f, "{}", message),
            ArchiveError::InvalidInput { message, .. } => write!(f, "{}", message),
            ArchiveError::CorruptedData { message, .. } => write!(f, "{}", message),
            ArchiveError::UnsupportedFeature { message, .. } => write!(f, "{}", message),
            ArchiveError::InvalidArchiveFormat { message, .. } => write!(f, "{}", message),
            ArchiveError::ParallelProcessingUnavailable { message, .. } => write!(f, "{}", message),
            ArchiveError::DictionaryError { message, .. } => write!(f, "{}", message),
            ArchiveError::StreamError { message, .. } => write!(f, "{}", message),
        }
    }
}

impl StdError for ArchiveError {}

impl From<io::Error> for ArchiveError {
    fn from(e: io::Error) -> Self {
        let message = e.to_string();
        match e.kind() {
            io::ErrorKind::InvalidData => ArchiveError::CorruptedData { code: 2012, message },
            io::ErrorKind::PermissionDenied => ArchiveError::InvalidInput { code: 2011, message },
            io::ErrorKind::UnexpectedEof => ArchiveError::InvalidInput { code: 2011, message },
            _ => ArchiveError::IoError { code: 2005, message },
        }
    }
}

impl From<CryptoError> for ArchiveError {
    fn from(e: CryptoError) -> Self {
        ArchiveError::EncryptionError { code: 2006, message: format!("{:?}", e) }
    }
}

impl From<zip::result::ZipError> for ArchiveError {
    fn from(e: zip::result::ZipError) -> Self {
        ArchiveError::IoError { code: 2005, message: e.to_string() }
    }
}

impl From<JsValue> for ArchiveError {
    fn from(value: JsValue) -> Self {
        ArchiveError::EncryptionError { code: 2006, message: value.as_string().unwrap_or_else(|| "Unknown JS error".to_string()) }
    }
}

impl From<ArchiveError> for JsValue {
    fn from(err: ArchiveError) -> Self {
        let (code, message) = match err {
            ArchiveError::InvalidChunkSize { code, message } => (code, message),
            ArchiveError::InvalidCompressionLevel { code, message } => (code, message),
            ArchiveError::UnsupportedAlgorithm { code, message } => (code, message),
            ArchiveError::OperationAborted { code, message } => (code, message),
            ArchiveError::IoError { code, message } => (code, message),
            ArchiveError::EncryptionError { code, message } => (code, message),
            ArchiveError::ChecksumMismatch { code, message } => (code, message),
            ArchiveError::InvalidMasterKey { code, message } => (code, message),
            ArchiveError::MemoryLimitExceeded { code, message } => (code, message),
            ArchiveError::InvalidPreset { code, message } => (code, message),
            ArchiveError::InvalidInput { code, message } => (code, message),
            ArchiveError::CorruptedData { code, message } => (code, message),
            ArchiveError::UnsupportedFeature { code, message } => (code, message),
            ArchiveError::InvalidArchiveFormat { code, message } => (code, message),
            ArchiveError::ParallelProcessingUnavailable { code, message } => (code, message),
            ArchiveError::DictionaryError { code, message } => (code, message),
            ArchiveError::StreamError { code, message } => (code, message),
        };
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("code"), &JsValue::from(code)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("message"), &JsValue::from_str(&message)).unwrap();
        obj.into()
    }
}

struct SafeChecksum {
    value: u32,
}

impl SafeChecksum {
    fn new() -> Self {
        SafeChecksum { value: 0xFFFFFFFFu32 }
    }

    fn update(&mut self, buf: &[u8]) {
        let mut crc = self.value;
        for &byte in buf {
            crc ^= byte as u32;
            for _ in 0..8 {
                crc = if crc & 1 != 0 { (crc >> 1) ^ 0xEDB88320 } else { crc >> 1 };
            }
        }
        self.value = crc;
    }

    fn finalize(self) -> u32 {
        self.value ^ 0xFFFFFFFF
    }
}

#[wasm_bindgen]
pub struct ArchiveFile {
    name: String,
    data: Bytes,
    modified_time: Option<u64>,
    permissions: Option<u32>,
    checksum: Option<u32>,
}

#[wasm_bindgen]
impl ArchiveFile {
    #[wasm_bindgen(constructor)]
    pub fn new(name: String, data: Vec<u8>) -> Self {
        let mut checksum = SafeChecksum::new();
        checksum.update(&data);
        ArchiveFile {
            name,
            data: Bytes::from(data),
            modified_time: None,
            permissions: None,
            checksum: Some(checksum.finalize()),
        }
    }

    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn data(&self) -> Vec<u8> {
        self.data.to_vec()
    }

    pub fn set_modified_time(&mut self, mtime: Option<u64>) {
        self.modified_time = mtime;
    }

    pub fn set_permissions(&mut self, permissions: Option<u32>) {
        self.permissions = permissions;
    }

    pub fn verify_checksum(&self) -> bool {
        match self.checksum {
            Some(expected) => {
                let mut checksum = SafeChecksum::new();
                checksum.update(&self.data);
                checksum.finalize() == expected
            }
            None => true,
        }
    }
}

#[wasm_bindgen]
pub struct ArchiveConfigBuilder {
    level: Option<i32>,
    algorithm: Option<CompressionAlgorithm>,
    chunk_size: Option<usize>,
    comment: Option<String>,
    extra: Option<Vec<u8>>,
    os_code: Option<u32>,
    encryption_config: Option<Config>,
    encryption_context: Option<Uint8Array>,
    encryption_aad: Option<Uint8Array>,
    checksum: Option<bool>,
    memory_limit: Option<usize>,
    preset: Option<String>,
    dict: Option<Vec<u8>>,
    archive_format: Option<ArchiveFormat>,
}

#[wasm_bindgen]
impl ArchiveConfigBuilder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        ArchiveConfigBuilder {
            level: None,
            algorithm: None,
            chunk_size: None,
            comment: None,
            extra: None,
            os_code: None,
            encryption_config: None,
            encryption_context: None,
            encryption_aad: None,
            checksum: None,
            memory_limit: None,
            preset: None,
            dict: None,
            archive_format: None,
        }
    }

    pub fn level(mut self, level: i32) -> Self {
        self.level = Some(level);
        self
    }

    pub fn algorithm(mut self, algorithm: CompressionAlgorithm) -> Self {
        self.algorithm = Some(algorithm);
        self
    }

    pub fn chunk_size(mut self, chunk_size: usize) -> Self {
        self.chunk_size = Some(chunk_size);
        self
    }

    pub fn comment(mut self, comment: Option<String>) -> Self {
        self.comment = comment;
        self
    }

    pub fn extra(mut self, extra: Option<Uint8Array>) -> Self {
        self.extra = extra.map(|e| e.to_vec());
        self
    }

    pub fn os_code(mut self, os_code: Option<u32>) -> Self {
        self.os_code = os_code;
        self
    }

    pub fn encryption_config(mut self, config: Option<Config>) -> Self {
        self.encryption_config = config;
        self
    }

    pub fn encryption_context(mut self, context: Option<Uint8Array>) -> Self {
        self.encryption_context = context;
        self
    }

    pub fn encryption_aad(mut self, aad: Option<Uint8Array>) -> Self {
        self.encryption_aad = aad;
        self
    }

    pub fn checksum(mut self, enable: bool) -> Self {
        self.checksum = Some(enable);
        self
    }

    pub fn memory_limit(mut self, limit: Option<usize>) -> Self {
        self.memory_limit = limit;
        self
    }

    pub fn preset(mut self, preset: Option<String>) -> Self {
        self.preset = preset;
        self
    }

    pub fn dict(mut self, dict: Option<Uint8Array>) -> Self {
        self.dict = dict.map(|d| d.to_vec());
        self
    }

    pub fn archive_format(mut self, format: ArchiveFormat) -> Self {
        self.archive_format = Some(format);
        self
    }

    pub fn build(self) -> Result<ArchiveConfig, JsValue> {
        let level = self.level.unwrap_or(6);
        let algorithm = self.algorithm.unwrap_or(CompressionAlgorithm::Gzip);
        let chunk_size = self.chunk_size.unwrap_or(DEFAULT_CHUNK_SIZE);
        let memory_limit = self.memory_limit.unwrap_or(MAX_MEMORY_LIMIT);

        if chunk_size == 0 {
            return Err(ArchiveError::InvalidChunkSize { 
                code: 2001, 
                message: "Chunk size must be greater than 0".to_string() 
            }.into());
        }

        if memory_limit > MAX_MEMORY_LIMIT {
            return Err(ArchiveError::MemoryLimitExceeded { 
                code: 2009, 
                message: format!("Memory limit exceeds maximum allowed {}", MAX_MEMORY_LIMIT) 
            }.into());
        }

        match algorithm {
            CompressionAlgorithm::Gzip | CompressionAlgorithm::Deflate | CompressionAlgorithm::Zlib => {
                if !(0..=9).contains(&level) {
                    return Err(ArchiveError::InvalidCompressionLevel {
                        code: 2002,
                        message: format!("Compression level for {:?} must be between 0 and 9", algorithm),
                    }.into());
                }
            }
            CompressionAlgorithm::Brotli => {
                if !(0..=11).contains(&level) {
                    return Err(ArchiveError::InvalidCompressionLevel {
                        code: 2002,
                        message: format!("Compression level for Brotli must be between 0 and 11"),
                    }.into());
                }
            }
            CompressionAlgorithm::None => {
                if level != 6 {
                    return Err(ArchiveError::InvalidCompressionLevel {
                        code: 2002,
                        message: "Compression level ignored for None algorithm".to_string(),
                    }.into());
                }
            }
        }

        Ok(ArchiveConfig {
            level,
            algorithm,
            chunk_size,
            comment: self.comment,
            extra: self.extra,
            os_code: self.os_code,
            encryption_config: self.encryption_config,
            encryption_context: self.encryption_context,
            encryption_aad: self.encryption_aad,
            checksum: self.checksum.unwrap_or(false),
            memory_limit: Some(memory_limit),
            preset: self.preset,
            dict: self.dict,
            archive_format: self.archive_format.unwrap_or(ArchiveFormat::None),
        })
    }
}

#[allow(dead_code)]
#[wasm_bindgen]
pub struct ArchiveConfig {
    level: i32,
    algorithm: CompressionAlgorithm,
    chunk_size: usize,
    comment: Option<String>,
    extra: Option<Vec<u8>>,
    os_code: Option<u32>,
    encryption_config: Option<Config>,
    encryption_context: Option<Uint8Array>,
    encryption_aad: Option<Uint8Array>,
    checksum: bool,
    memory_limit: Option<usize>,
    preset: Option<String>,
    dict: Option<Vec<u8>>,
    archive_format: ArchiveFormat,
}

#[wasm_bindgen]
impl ArchiveConfig {
    pub fn builder() -> ArchiveConfigBuilder {
        ArchiveConfigBuilder::new()
    }

    pub fn level(&self) -> i32 {
        self.level
    }

    pub fn algorithm(&self) -> CompressionAlgorithm {
        self.algorithm.clone()
    }

    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }
}

#[allow(dead_code)]
struct CompressionContext {
    encoder: CompressionEncoder,
    buffer_pool: Vec<BytesMut>,
}

impl CompressionContext {
    fn new(config: &ArchiveConfig) -> Result<Self, ArchiveError> {
        let level = config.level;

        let encoder = match config.algorithm {
            CompressionAlgorithm::None => CompressionEncoder::None(Vec::with_capacity(config.chunk_size)),
            CompressionAlgorithm::Gzip => {
                let mut builder = GzBuilder::new();
                if let Some(ref c) = config.comment {
                    builder = builder.comment(c.as_bytes());
                }
                if let Some(ref e) = config.extra {
                    builder = builder.extra(e.clone());
                }
                CompressionEncoder::Gzip(builder.write(Vec::with_capacity(config.chunk_size), Compression::new(level as u32)))
            }
            CompressionAlgorithm::Zlib => CompressionEncoder::Zlib(FlateZlibEncoder::new(Vec::with_capacity(config.chunk_size), Compression::new(level as u32))),
            CompressionAlgorithm::Deflate => CompressionEncoder::Deflate(FlateDeflateEncoder::new(Vec::with_capacity(config.chunk_size), Compression::new(level as u32))),
            CompressionAlgorithm::Brotli => {
                let mut params = BrotliEncoderParams::default();
                params.quality = level;
                params.size_hint = config.chunk_size;
                CompressionEncoder::Brotli(BrotliCompressorWriter::with_params(
                    Vec::with_capacity(config.chunk_size),
                    config.chunk_size,
                    &params,
                ))
            }
        };

        Ok(CompressionContext {
            encoder,
            buffer_pool: Vec::new(),
        })
    }

    #[allow(dead_code)]
    fn get_buffer(&mut self, size: usize) -> BytesMut {
        self.buffer_pool.pop()
            .filter(|b| b.capacity() >= size)
            .unwrap_or_else(|| BytesMut::with_capacity(size))
    }

    #[allow(dead_code)]
    fn return_buffer(&mut self, mut buffer: BytesMut) {
        buffer.clear();
        self.buffer_pool.push(buffer);
    }
}

enum CompressionEncoder {
    None(Vec<u8>),
    Gzip(FlateGzEncoder<Vec<u8>>),
    Zlib(FlateZlibEncoder<Vec<u8>>),
    Deflate(FlateDeflateEncoder<Vec<u8>>),
    Brotli(BrotliCompressorWriter<Vec<u8>>),
}

impl Write for CompressionEncoder {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self {
            CompressionEncoder::None(v) => v.write(buf),
            CompressionEncoder::Gzip(e) => e.write(buf),
            CompressionEncoder::Zlib(e) => e.write(buf),
            CompressionEncoder::Deflate(e) => e.write(buf),
            CompressionEncoder::Brotli(e) => e.write(buf),
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        match self {
            CompressionEncoder::None(v) => v.flush(),
            CompressionEncoder::Gzip(e) => e.flush(),
            CompressionEncoder::Zlib(e) => e.flush(),
            CompressionEncoder::Deflate(e) => e.flush(),
            CompressionEncoder::Brotli(e) => e.flush(),
        }
    }
}

impl CompressionEncoder {
    fn finish(self) -> Result<Vec<u8>, io::Error> {
        match self {
            CompressionEncoder::None(v) => Ok(v),
            CompressionEncoder::Gzip(e) => e.finish(),
            CompressionEncoder::Zlib(e) => e.finish(),
            CompressionEncoder::Deflate(e) => e.finish(),
            CompressionEncoder::Brotli(e) => Ok(e.into_inner()),
        }
    }
}

#[allow(dead_code)]
struct DecompressionContext<'a> {
    decoder: CompressionDecoder<'a>,
    buffer_pool: Vec<BytesMut>,
    dict: Option<Vec<u8>>,
}

impl<'a> DecompressionContext<'a> {
    fn new(config: &ArchiveConfig, input: &'a [u8]) -> Result<Self, ArchiveError> {
        let pos = Arc::new(AtomicUsize::new(0));
        let dict = config.dict.clone();

        let decoder = match config.algorithm {
            CompressionAlgorithm::None => CompressionDecoder::None(Box::new(TrackingReader { buf: input, pos: pos.clone() })),
            CompressionAlgorithm::Gzip => {
                CompressionDecoder::Gzip(FlateGzDecoder::new(TrackingReader { buf: input, pos: pos.clone() }))
            }
            CompressionAlgorithm::Zlib => {
                CompressionDecoder::Zlib(FlateZlibDecoder::new(TrackingReader { buf: input, pos: pos.clone() }))
            }
            CompressionAlgorithm::Deflate => {
                CompressionDecoder::Deflate(FlateDeflateDecoder::new(TrackingReader { buf: input, pos: pos.clone() }))
            }
            CompressionAlgorithm::Brotli => {
                let reader = TrackingReader { buf: input, pos: pos.clone() };
                CompressionDecoder::Brotli(BrotliDecompressor::new(reader, config.chunk_size), pos)
            }
        };

        Ok(DecompressionContext {
            decoder,
            buffer_pool: Vec::new(),
            dict,
        })
    }

    #[allow(dead_code)]
    fn get_buffer(&mut self, size: usize) -> BytesMut {
        self.buffer_pool.pop()
            .filter(|b| b.capacity() >= size)
            .unwrap_or_else(|| BytesMut::with_capacity(size))
    }

    #[allow(dead_code)]
    fn return_buffer(&mut self, mut buffer: BytesMut) {
        buffer.clear();
        self.buffer_pool.push(buffer);
    }

    fn consumed(&self) -> usize {
        self.decoder.consumed()
    }
}

enum CompressionDecoder<'a> {
    None(Box<TrackingReader<'a>>),
    Gzip(FlateGzDecoder<TrackingReader<'a>>),
    Zlib(FlateZlibDecoder<TrackingReader<'a>>),
    Deflate(FlateDeflateDecoder<TrackingReader<'a>>),
    Brotli(BrotliDecompressor<TrackingReader<'a>>, Arc<AtomicUsize>),
}

impl<'a> CompressionDecoder<'a> {
    fn consumed(&self) -> usize {
        match self {
            CompressionDecoder::None(r) => r.pos.load(Ordering::SeqCst),
            CompressionDecoder::Gzip(d) => d.get_ref().pos.load(Ordering::SeqCst),
            CompressionDecoder::Zlib(d) => d.get_ref().pos.load(Ordering::SeqCst),
            CompressionDecoder::Deflate(d) => d.get_ref().pos.load(Ordering::SeqCst),
            CompressionDecoder::Brotli(_, p) => p.load(Ordering::SeqCst),
        }
    }
}

impl<'a> Read for CompressionDecoder<'a> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            CompressionDecoder::None(r) => r.read(buf),
            CompressionDecoder::Gzip(d) => d.read(buf),
            CompressionDecoder::Zlib(d) => d.read(buf),
            CompressionDecoder::Deflate(d) => d.read(buf),
            CompressionDecoder::Brotli(d, _) => d.read(buf),
        }
    }
}

struct TrackingReader<'a> {
    buf: &'a [u8],
    pos: Arc<AtomicUsize>,
}

impl<'a> Read for TrackingReader<'a> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let pos = self.pos.load(Ordering::SeqCst);
        let available = &self.buf[pos..];
        let n = buf.len().min(available.len());
        buf[..n].copy_from_slice(&available[..n]);
        self.pos.fetch_add(n, Ordering::SeqCst);
        Ok(n)
    }
}

impl<'a> BufRead for TrackingReader<'a> {
    fn fill_buf(&mut self) -> io::Result<&[u8]> {
        let pos = self.pos.load(Ordering::SeqCst);
        Ok(&self.buf[pos..])
    }

    fn consume(&mut self, amt: usize) {
        self.pos.fetch_add(amt, Ordering::SeqCst);
    }
}
#[wasm_bindgen]
pub struct StreamArchiver {
    config: ArchiveConfig,
    progress_callback: Option<Function>,
    abort_signal: Option<AbortSignal>,
    master_key: Option<SecureBytes>,
    metrics_callback: Option<Function>,
    aborted: Arc<AtomicBool>,
}

#[wasm_bindgen]
impl StreamArchiver {
    #[wasm_bindgen(constructor)]
    pub fn new(config: ArchiveConfig) -> Self {
        StreamArchiver {
            config,
            progress_callback: None,
            abort_signal: None,
            master_key: None,
            metrics_callback: None,
            aborted: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn set_progress_callback(&mut self, callback: Function) {
        self.progress_callback = Some(callback);
    }

    pub fn set_abort_signal(&mut self, signal: AbortSignal) {
        self.abort_signal = Some(signal.clone());
        let aborted = self.aborted.clone();
        let closure = Closure::<dyn FnMut()>::new(move || {
            aborted.store(true, Ordering::SeqCst);
        });
        signal.set_onabort(Some(closure.as_ref().unchecked_ref()));
        closure.forget();
    }

    pub fn set_master_key(&mut self, key: SecureBytes) {
        self.master_key = Some(key);
    }

    pub fn set_metrics_callback(&mut self, callback: Function) {
        self.metrics_callback = Some(callback);
    }

    fn check_aborted(&self) -> Result<(), ArchiveError> {
        if self.aborted.load(Ordering::SeqCst) {
            Err(ArchiveError::OperationAborted { 
                code: 2004, 
                message: "Operation aborted by user".to_string() 
            })
        } else {
            Ok(())
        }
    }

    fn get_current_timestamp() -> u64 {
        (Date::now() / 1000.0) as u64
    }

    fn create_archive(&self, files: Vec<ArchiveFile>) -> Result<Vec<u8>, ArchiveError> {
        let mut cursor = Cursor::new(Vec::new());
        match self.config.archive_format {
            ArchiveFormat::Zip => {
                let mut zip = ZipWriter::new(&mut cursor);
                let method = match self.config.algorithm {
                    CompressionAlgorithm::Deflate => ZipCompressionMethod::Deflated,
                    CompressionAlgorithm::None => ZipCompressionMethod::Stored,
                    _ => return Err(ArchiveError::UnsupportedAlgorithm { 
                        code: 2003, 
                        message: "Unsupported compression method for Zip".to_string() 
                    }),
                };
                for file in files {
                    self.check_aborted()?;
                    let mtime = file.modified_time.unwrap_or_else(Self::get_current_timestamp);
                    
                    let seconds = mtime % 60;
                    let minutes = (mtime / 60) % 60;
                    let hours = (mtime / 3600) % 24;
                    let days = (mtime / 86400) % 31 + 1;
                    let months = (mtime / 2678400) % 12 + 1;
                    let years = (mtime / 31536000) + 1980;
                    
                    let zip_time = zip::DateTime::from_date_and_time(
                        years as u16,
                        months as u8,
                        days as u8,
                        hours as u8,
                        minutes as u8,
                        seconds as u8
                    ).unwrap_or_default();
                    
                    let options = FileOptions::default()
                        .compression_method(method)
                        .unix_permissions(file.permissions.unwrap_or(0o644))
                        .last_modified_time(zip_time);
                    zip.start_file(&file.name, options)?;
                    zip.write_all(&file.data[..])?;
                }
                let _ = zip.finish()?;
            }
            ArchiveFormat::None => {
                if files.len() != 1 {
                    return Err(ArchiveError::InvalidArchiveFormat { 
                        code: 2014, 
                        message: "Single file required when no archive format specified".to_string() 
                    });
                }
                cursor.write_all(&files[0].data)?;
            }
        }
        Ok(cursor.into_inner())
    }

    fn extract_archive(&self, data: &[u8]) -> Result<Vec<ArchiveFile>, ArchiveError> {
        let mut files = Vec::new();
        match self.config.archive_format {
            ArchiveFormat::Zip => {
                let mut zip = ZipArchive::new(Cursor::new(data))?;
                for i in 0..zip.len() {
                    self.check_aborted()?;
                    let mut file = zip.by_index(i)?;
                    let mut buffer = Vec::with_capacity(file.size() as usize);
                    file.read_to_end(&mut buffer)?;
                    let dt = file.last_modified();
                    let js_date = Date::new_with_year_month_day_hr_min_sec(dt.year() as u32, (dt.month() - 1) as i32, dt.day() as i32, dt.hour() as i32, dt.minute() as i32, dt.second() as i32);
                    let time_ms = js_date.get_time();
                    let modified_time = if time_ms.is_nan() {
                        Self::get_current_timestamp()
                    } else {
                        (time_ms / 1000.0) as u64
                    };
                    files.push(ArchiveFile {
                        name: file.name().to_string(),
                        data: Bytes::from(buffer),
                        modified_time: Some(modified_time),
                        permissions: file.unix_mode().map(|m| m as u32),
                        checksum: None,
                    });
                }
            }
            ArchiveFormat::None => {
                files.push(ArchiveFile {
                    name: "data".to_string(),
                    data: Bytes::from(data.to_vec()),
                    modified_time: None,
                    permissions: None,
                    checksum: None,
                });
            }
        }
        Ok(files)
    }

    pub async fn archive_files(&self, files: Vec<ArchiveFile>) -> Result<Vec<u8>, JsValue> {
        let start_time = Date::now();
        self.check_aborted()?;

        let total_size: usize = files.iter().map(|f| f.data.len()).sum();
        if let Some(limit) = self.config.memory_limit {
            if total_size > limit {
                return Err(ArchiveError::MemoryLimitExceeded { 
                    code: 2009, 
                    message: format!("Input size {} exceeds memory limit {}", total_size, limit) 
                }.into());
            }
        }

        let archive_data = self.create_archive(files)?;

        let mut ctx = CompressionContext::new(&self.config)?;
        let mut processed = 0.0;

        for chunk in archive_data.chunks(self.config.chunk_size) {
            self.check_aborted()?;
            ctx.encoder.write_all(chunk).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            processed += chunk.len() as f64;
            if let Some(ref callback) = self.progress_callback {
                let progress = processed / total_size as f64;
                callback.call1(&JsValue::NULL, &JsValue::from_f64(progress))?;
            }
        }
        ctx.encoder.flush().map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
        let mut output = ctx.encoder.finish().map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;

        if self.config.checksum {
            let mut checksum = SafeChecksum::new();
            checksum.update(&output);
            output.extend_from_slice(&checksum.finalize().to_le_bytes());
        }

        if let Some(ref enc_config) = self.config.encryption_config {
            let mk = self.master_key.as_ref().ok_or_else(|| ArchiveError::InvalidMasterKey { 
                code: 2008, 
                message: "Master key required for encryption".to_string() 
            })?;
            let crypto = CryptoService::new(mk.data(), enc_config)?;
            let context = self.config.encryption_context.clone().unwrap_or_else(|| Uint8Array::new_with_length(0));
            let aad = self.config.encryption_aad.clone();
            let encrypted = crypto.encrypt(Uint8Array::from(&output[..]), context, aad).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            output = encrypted.to_vec();
        }

        let end_time = Date::now();
        self.report_metrics(start_time, end_time, total_size, output.len())?;

        Ok(output)
    }

    pub async fn unarchive_files(&self, data: &[u8]) -> Result<Vec<ArchiveFile>, JsValue> {
        let start_time = Date::now();
        self.check_aborted()?;

        if let Some(limit) = self.config.memory_limit {
            if data.len() > limit {
                return Err(ArchiveError::MemoryLimitExceeded { 
                    code: 2009, 
                    message: format!("Input size {} exceeds memory limit {}", data.len(), limit) 
                }.into());
            }
        }

        let mut input = if let Some(ref enc_config) = self.config.encryption_config {
            let mk = self.master_key.as_ref().ok_or_else(|| ArchiveError::InvalidMasterKey { 
                code: 2008, 
                message: "Master key required for decryption".to_string() 
            })?;
            let crypto = CryptoService::new(mk.data(), enc_config)?;
            let context = self.config.encryption_context.clone().unwrap_or_else(|| Uint8Array::new_with_length(0));
            let aad = self.config.encryption_aad.clone();
            let decrypted = crypto.decrypt(Uint8Array::from(data), context, aad).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            decrypted.to_vec()
        } else {
            data.to_vec()
        };

        if self.config.checksum {
            if input.len() < 4 {
                return Err(ArchiveError::InvalidInput { 
                    code: 2011, 
                    message: "Input too short for checksum verification".to_string() 
                }.into());
            }
            let (data_part, checksum_bytes) = input.split_at(input.len() - 4);
            let expected_crc = u32::from_le_bytes([checksum_bytes[0], checksum_bytes[1], checksum_bytes[2], checksum_bytes[3]]);
            let mut checksum = SafeChecksum::new();
            checksum.update(data_part);
            if checksum.finalize() != expected_crc {
                return Err(ArchiveError::ChecksumMismatch { 
                    code: 2007, 
                    message: "Checksum verification failed".to_string() 
                }.into());
            }
            input = data_part.to_vec();
        }

        let total_size = input.len();
        let mut ctx = DecompressionContext::new(&self.config, &input)?;
        let mut buffer = Vec::with_capacity(total_size * 2);
        let mut chunk = vec![0u8; self.config.chunk_size];

        loop {
            self.check_aborted()?;
            let bytes_read = ctx.decoder.read(&mut chunk).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            if bytes_read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..bytes_read]);
            let processed = ctx.consumed() as f64;
            if let Some(ref callback) = self.progress_callback {
                let progress = processed / total_size as f64;
                callback.call1(&JsValue::NULL, &JsValue::from_f64(progress))?;
            }
        }

        let files = self.extract_archive(&buffer)?;

        let output_size: usize = files.iter().map(|f| f.data.len()).sum();
        let end_time = Date::now();
        self.report_metrics(start_time, end_time, total_size, output_size)?;

        Ok(files)
    }

    fn report_metrics(&self, start_time: f64, end_time: f64, input_size: usize, output_size: usize) -> Result<(), JsValue> {
        if let Some(ref callback) = self.metrics_callback {
            let time_taken = end_time - start_time;
            let ratio = if input_size > 0 {
                output_size as f64 / input_size as f64
            } else {
                1.0
            };
            let metrics_obj = Object::new();
            Reflect::set(&metrics_obj, &JsValue::from_str("ratio"), &JsValue::from_f64(ratio))?;
            Reflect::set(&metrics_obj, &JsValue::from_str("time"), &JsValue::from_f64(time_taken))?;
            Reflect::set(&metrics_obj, &JsValue::from_str("inputSize"), &JsValue::from(input_size as u32))?;
            Reflect::set(&metrics_obj, &JsValue::from_str("outputSize"), &JsValue::from(output_size as u32))?;
            callback.call1(&JsValue::NULL, &metrics_obj.into())?;
        }
        Ok(())
    }

    pub async fn archive_stream(&self, stream: ReadableStream) -> Result<Vec<u8>, JsValue> {
        if matches!(self.config.archive_format, ArchiveFormat::Zip) {
            return Err(ArchiveError::UnsupportedFeature { 
                code: 2013, 
                message: "Zip not supported for streaming input".to_string() 
            }.into());
        }
        let start_time = Date::now();
        self.check_aborted()?;

        let reader = stream.get_reader().unchecked_into::<ReadableStreamDefaultReader>();
        let mut ctx = CompressionContext::new(&self.config)?;
        let mut total_size = 0;

        loop {
            self.check_aborted()?;
            let read_result = JsFuture::from(reader.read()).await?;
            let done = Reflect::get(&read_result, &JsValue::from_str("done"))?.as_bool().unwrap_or(true);
            if done {
                break;
            }

            let chunk = Reflect::get(&read_result, &JsValue::from_str("value"))?;
            let chunk_data = Uint8Array::new(&chunk).to_vec();
            total_size += chunk_data.len();

            if let Some(limit) = self.config.memory_limit {
                if total_size > limit {
                    return Err(ArchiveError::MemoryLimitExceeded { 
                        code: 2009, 
                        message: format!("Stream size exceeds memory limit {}", limit) 
                    }.into());
                }
            }

            ctx.encoder.write_all(&chunk_data).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            if let Some(ref callback) = self.progress_callback {
                let progress = total_size as f64 / (total_size + 1) as f64;
                callback.call1(&JsValue::NULL, &JsValue::from_f64(progress))?;
            }
        }

        ctx.encoder.flush().map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
        let mut output = ctx.encoder.finish().map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;

        if self.config.checksum {
            let mut checksum = SafeChecksum::new();
            checksum.update(&output);
            output.extend_from_slice(&checksum.finalize().to_le_bytes());
        }

        if let Some(ref enc_config) = self.config.encryption_config {
            let mk = self.master_key.as_ref().ok_or_else(|| ArchiveError::InvalidMasterKey { 
                code: 2008, 
                message: "Master key required for encryption".to_string() 
            })?;
            let crypto = CryptoService::new(mk.data(), enc_config)?;
            let context = self.config.encryption_context.clone().unwrap_or_else(|| Uint8Array::new_with_length(0));
            let aad = self.config.encryption_aad.clone();
            let encrypted = crypto.encrypt(Uint8Array::from(&output[..]), context, aad).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            output = encrypted.to_vec();
        }

        let end_time = Date::now();
        self.report_metrics(start_time, end_time, total_size, output.len())?;

        Ok(output)
    }

    pub async fn unarchive_stream(&self, stream: ReadableStream) -> Result<Vec<ArchiveFile>, JsValue> {
        let start_time = Date::now();
        self.check_aborted()?;

        let reader = stream.get_reader().unchecked_into::<ReadableStreamDefaultReader>();
        let mut input = Vec::new();
        let mut total_size = 0;

        loop {
            self.check_aborted()?;
            let read_result = JsFuture::from(reader.read()).await?;
            let done = Reflect::get(&read_result, &JsValue::from_str("done"))?.as_bool().unwrap_or(true);
            if done {
                break;
            }

            let chunk = Reflect::get(&read_result, &JsValue::from_str("value"))?;
            let chunk_data = Uint8Array::new(&chunk).to_vec();
            total_size += chunk_data.len();

            if let Some(limit) = self.config.memory_limit {
                if total_size > limit {
                    return Err(ArchiveError::MemoryLimitExceeded { 
                        code: 2009, 
                        message: format!("Stream size exceeds memory limit {}", limit) 
                    }.into());
                }
            }

            input.extend_from_slice(&chunk_data);
            if let Some(ref callback) = self.progress_callback {
                let progress = total_size as f64 / (total_size + 1) as f64;
                callback.call1(&JsValue::NULL, &JsValue::from_f64(progress))?;
            }
        }

        if let Some(ref enc_config) = self.config.encryption_config {
            let mk = self.master_key.as_ref().ok_or_else(|| ArchiveError::InvalidMasterKey { 
                code: 2008, 
                message: "Master key required for decryption".to_string() 
            })?;
            let crypto = CryptoService::new(mk.data(), enc_config)?;
            let context = self.config.encryption_context.clone().unwrap_or_else(|| Uint8Array::new_with_length(0));
            let aad = self.config.encryption_aad.clone();
            let decrypted = crypto.decrypt(Uint8Array::from(&input[..]), context, aad).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            input = decrypted.to_vec();
        }

        if self.config.checksum {
            if input.len() < 4 {
                return Err(ArchiveError::InvalidInput { 
                    code: 2011, 
                    message: "Input too short for checksum verification".to_string() 
                }.into());
            }
            let (data_part, checksum_bytes) = input.split_at(input.len() - 4);
            let expected_crc = u32::from_le_bytes([checksum_bytes[0], checksum_bytes[1], checksum_bytes[2], checksum_bytes[3]]);
            let mut checksum = SafeChecksum::new();
            checksum.update(data_part);
            if checksum.finalize() != expected_crc {
                return Err(ArchiveError::ChecksumMismatch { 
                    code: 2007, 
                    message: "Checksum verification failed".to_string() 
                }.into());
            }
            input = data_part.to_vec();
        }

        let total_size = input.len();
        let mut ctx = DecompressionContext::new(&self.config, &input)?;
        let mut buffer = Vec::with_capacity(total_size * 2);
        let mut chunk = vec![0u8; self.config.chunk_size];

        loop {
            self.check_aborted()?;
            let bytes_read = ctx.decoder.read(&mut chunk).map_err(|e| Into::<JsValue>::into(ArchiveError::from(e)))?;
            if bytes_read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..bytes_read]);
            let processed = ctx.consumed() as f64;
            if let Some(ref callback) = self.progress_callback {
                let progress = processed / total_size as f64;
                callback.call1(&JsValue::NULL, &JsValue::from_f64(progress))?;
            }
        }

        let files = self.extract_archive(&buffer)?;

        let output_size: usize = files.iter().map(|f| f.data.len()).sum();
        let end_time = Date::now();
        self.report_metrics(start_time, end_time, total_size, output_size)?;

        Ok(files)
    }
}

#[wasm_bindgen]
pub async fn archive_files_blob(files: Vec<ArchiveFile>, config: ArchiveConfig, progress_callback: Option<Function>, abort_signal: Option<AbortSignal>) -> Result<Blob, JsValue> {
    let mut archiver = StreamArchiver::new(config);
    if let Some(callback) = progress_callback {
        archiver.set_progress_callback(callback);
    }
    if let Some(sig) = abort_signal {
        archiver.set_abort_signal(sig);
    }

    let compressed = archiver.archive_files(files).await?;

    let options = BlobPropertyBag::new();
    options.set_type(match archiver.config.algorithm {
        CompressionAlgorithm::Gzip => "application/gzip",
        CompressionAlgorithm::Zlib => "application/zlib",
        CompressionAlgorithm::Deflate => "application/deflate",
        CompressionAlgorithm::Brotli => "application/brotli",
        CompressionAlgorithm::None => "application/octet-stream",
    });

    let array = js_sys::Array::new();
    array.push(&Uint8Array::from(&compressed[..]));
    Blob::new_with_buffer_source_sequence_and_options(&array, &options)
        .map_err(|e| ArchiveError::IoError { code: 2005, message: e.as_string().unwrap_or("Blob creation failed".to_string()) }.into())
}

#[wasm_bindgen]
pub async fn unarchive_files_blob(blob: Blob, config: ArchiveConfig, progress_callback: Option<Function>, abort_signal: Option<AbortSignal>) -> Result<Vec<ArchiveFile>, JsValue> {
    let mut archiver = StreamArchiver::new(config);
    if let Some(callback) = progress_callback {
        archiver.set_progress_callback(callback);
    }
    if let Some(sig) = abort_signal {
        archiver.set_abort_signal(sig);
    }

    let array_buffer = JsFuture::from(blob.array_buffer()).await?;
    let data = Uint8Array::new(&array_buffer).to_vec();

    archiver.unarchive_files(&data).await
}

#[wasm_bindgen]
pub async fn archive_stream(stream: ReadableStream, config: ArchiveConfig, progress_callback: Option<Function>, abort_signal: Option<AbortSignal>) -> Result<Blob, JsValue> {
    let mut archiver = StreamArchiver::new(config);
    if let Some(callback) = progress_callback {
        archiver.set_progress_callback(callback);
    }
    if let Some(sig) = abort_signal {
        archiver.set_abort_signal(sig);
    }

    let compressed = archiver.archive_stream(stream).await?;

    let options = BlobPropertyBag::new();
    options.set_type(match archiver.config.algorithm {
        CompressionAlgorithm::Gzip => "application/gzip",
        CompressionAlgorithm::Zlib => "application/zlib",
        CompressionAlgorithm::Deflate => "application/deflate",
        CompressionAlgorithm::Brotli => "application/brotli",
        CompressionAlgorithm::None => "application/octet-stream",
    });

    let array = js_sys::Array::new();
    array.push(&Uint8Array::from(&compressed[..]));
    Blob::new_with_buffer_source_sequence_and_options(&array, &options)
        .map_err(|e| ArchiveError::IoError { code: 2005, message: e.as_string().unwrap_or("Blob creation failed".to_string()) }.into())
}

#[wasm_bindgen]
pub async fn unarchive_stream(stream: ReadableStream, config: ArchiveConfig, progress_callback: Option<Function>, abort_signal: Option<AbortSignal>) -> Result<Vec<ArchiveFile>, JsValue> {
    let mut archiver = StreamArchiver::new(config);
    if let Some(callback) = progress_callback {
        archiver.set_progress_callback(callback);
    }
    if let Some(sig) = abort_signal {
        archiver.set_abort_signal(sig);
    }

    archiver.unarchive_stream(stream).await
}

#[wasm_bindgen(start)]
pub fn init() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}