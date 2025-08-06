#[allow(unused_imports)]
use symphonia::core::codecs::{Decoder, DecoderOptions};
#[allow(unused_imports)]
use symphonia::core::formats::{FormatOptions, FormatReader};
#[allow(unused_imports)]
use symphonia::core::io::MediaSourceStream;
#[allow(unused_imports)]
use symphonia::core::meta::MetadataOptions;
#[allow(unused_imports)]
use symphonia::core::probe::Hint;
#[allow(unused_imports)]
use symphonia::core::audio::{AudioBufferRef, SampleBuffer, Channels, SignalSpec};
use hound::{WavSpec, WavWriter, WavReader};
#[allow(unused_imports)]
use rubato::{Resampler, SincFixedIn};
use std::io::Cursor;
use wasm_bindgen::prelude::*;
use wee_alloc::WeeAlloc;
use console_error_panic_hook;

#[global_allocator]
static ALLOC: WeeAlloc = WeeAlloc::INIT;

#[derive(Debug)]
pub enum ConversionError {
    InvalidInput,
    DecodeFailed(String),
    EncodeFailed(String),
    UnsupportedFormat,
    NoDefaultTrack,
    MissingCodecParams,
    ResampleFailed(String),
}

impl From<ConversionError> for JsValue {
    fn from(err: ConversionError) -> JsValue {
        JsValue::from_str(&format!("{:?}", err))
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct WavResult {
    data: Vec<u8>,
    sample_rate: u32,
    channels: u16,
    duration_secs: f64,
    progress: f32,
}

#[wasm_bindgen]
impl WavResult {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.data.len()
    }
    #[wasm_bindgen(getter)]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u16 {
        self.channels
    }
    #[wasm_bindgen(getter)]
    pub fn duration_secs(&self) -> f64 {
        self.duration_secs
    }
    #[wasm_bindgen(getter)]
    pub fn progress(&self) -> f32 {
        self.progress
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct PcmResult {
    data: Vec<i16>,
    sample_rate: u32,
    channels: u16,
    duration_secs: f64,
    progress: f32,
}

#[wasm_bindgen]
impl PcmResult {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<i16> {
        self.data.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.data.len()
    }
    #[wasm_bindgen(getter)]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u16 {
        self.channels
    }
    #[wasm_bindgen(getter)]
    pub fn duration_secs(&self) -> f64 {
        self.duration_secs
    }
    #[wasm_bindgen(getter)]
    pub fn progress(&self) -> f32 {
        self.progress
    }
}

fn decode_audio(data: &[u8], extension: &str) -> Result<(Vec<i16>, WavSpec, f64, u64, f32), ConversionError> {
    if data.is_empty() {
        return Err(ConversionError::InvalidInput);
    }

    let mss = MediaSourceStream::new(Box::new(Cursor::new(data.to_vec())), Default::default());
    let mut hint = Hint::new();
    hint.with_extension(extension);

    let format_opts = FormatOptions { enable_gapless: true, ..Default::default() };
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions { verify: true, ..Default::default() };

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| ConversionError::DecodeFailed(e.to_string()))?;

    let mut format = probed.format;
    let track = format.default_track().ok_or(ConversionError::NoDefaultTrack)?;
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| ConversionError::DecodeFailed(e.to_string()))?;

    let sample_rate = track.codec_params.sample_rate.ok_or(ConversionError::MissingCodecParams)?;
    let channels = track.codec_params.channels.ok_or(ConversionError::MissingCodecParams)?;
    let channel_count = channels.count() as u16;
    let total_packets = track.codec_params.n_frames.unwrap_or(0);
    let mut processed_packets = 0;
    let mut total_samples = 0;

    let mut pcm_buffer = Vec::with_capacity(data.len() / 2);
    let signal_spec = SignalSpec::new(sample_rate, channels);
    let mut sample_buffer = SampleBuffer::<i16>::new(total_packets, signal_spec);

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        processed_packets += 1;

        match decoder.decode(&packet) {
            Ok(decoded) => {
                sample_buffer.copy_interleaved_ref(decoded);
                let samples = sample_buffer.samples();
                total_samples += samples.len();
                pcm_buffer.extend_from_slice(samples);
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(ConversionError::DecodeFailed(e.to_string())),
        }
    }

    let progress = if total_packets > 0 {
        (processed_packets as f32 / total_packets as f32) * 100.0
    } else {
        100.0
    };

    let duration = total_samples as f64 / (sample_rate as f64 * channel_count as f64);
    let spec = WavSpec {
        channels: channel_count,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    Ok((pcm_buffer, spec, duration, total_packets, progress))
}

fn resample_audio(pcm_data: &[i16], spec: &WavSpec, target_sample_rate: u32) -> Result<(Vec<i16>, WavSpec), ConversionError> {
    if spec.sample_rate == target_sample_rate {
        return Ok((pcm_data.to_vec(), *spec));
    }

    let params = rubato::SincInterpolationParameters {
        sinc_len: 128,
        f_cutoff: 0.95,
        oversampling_factor: 128,
        interpolation: rubato::SincInterpolationType::Linear,
        window: rubato::WindowFunction::BlackmanHarris,
    };

    let mut resampler = SincFixedIn::<f64>::new(
        target_sample_rate as f64 / spec.sample_rate as f64,
        1.0,
        params,
        pcm_data.len() / spec.channels as usize,
        spec.channels as usize,
    ).map_err(|e| ConversionError::ResampleFailed(e.to_string()))?;

    let input: Vec<Vec<f64>> = pcm_data
        .chunks(spec.channels as usize)
        .map(|chunk| chunk.iter().map(|&s| s as f64).collect())
        .collect();

    let resampled = resampler
        .process(&input, None)
        .map_err(|e| ConversionError::ResampleFailed(e.to_string()))?;

    let output: Vec<i16> = resampled
        .into_iter()
        .flatten()
        .map(|s| s.clamp(i16::MIN as f64, i16::MAX as f64) as i16)
        .collect();

    let new_spec = WavSpec {
        sample_rate: target_sample_rate,
        ..*spec
    };

    Ok((output, new_spec))
}

fn encode_wav(pcm_data: &[i16], spec: WavSpec) -> Result<Vec<u8>, ConversionError> {
    let mut writer_cursor = Cursor::new(Vec::with_capacity(pcm_data.len() * 2));
    {
        let mut writer = WavWriter::new(&mut writer_cursor, spec)
            .map_err(|e| ConversionError::EncodeFailed(e.to_string()))?;

        for &sample in pcm_data {
            writer
                .write_sample(sample)
                .map_err(|e| ConversionError::EncodeFailed(e.to_string()))?;
        }
        writer
            .finalize()
            .map_err(|e| ConversionError::EncodeFailed(e.to_string()))?;
    }
    Ok(writer_cursor.into_inner())
}

#[wasm_bindgen]
pub fn mp3_to_wav(data: &[u8], format: &str, target_sample_rate: Option<u32>) -> Result<WavResult, JsValue> {
    console_error_panic_hook::set_once();

    let (pcm_data, spec, duration, _total_packets, progress) = decode_audio(data, format)?;

    let (pcm_data, spec) = if let Some(target_sr) = target_sample_rate {
        resample_audio(&pcm_data, &spec, target_sr)?
    } else {
        (pcm_data, spec)
    };

    let wav_data = encode_wav(&pcm_data, spec)?;

    Ok(WavResult {
        data: wav_data,
        sample_rate: spec.sample_rate,
        channels: spec.channels,
        duration_secs: duration,
        progress,
    })
}

#[wasm_bindgen]
pub fn wav_to_pcm(data: &[u8], target_sample_rate: Option<u32>) -> Result<PcmResult, JsValue> {
    console_error_panic_hook::set_once();

    if data.is_empty() {
        return Err(JsValue::from_str("Empty WAV data provided"));
    }

    let cursor = Cursor::new(data.to_vec());
    let mut reader = WavReader::new(cursor)
        .map_err(|e| ConversionError::DecodeFailed(e.to_string()))?;
    let spec = reader.spec();
    let pcm_data: Vec<i16> = reader
        .samples()
        .collect::<Result<Vec<i16>, _>>()
        .map_err(|e| ConversionError::DecodeFailed(e.to_string()))?;

    if spec.sample_format != hound::SampleFormat::Int || spec.bits_per_sample != 16 {
        return Err(JsValue::from_str(
            "Unsupported WAV format: only 16-bit integer PCM supported",
        ));
    }

    let (pcm_data, spec) = if let Some(target_sr) = target_sample_rate {
        resample_audio(&pcm_data, &spec, target_sr)?
    } else {
        (pcm_data, spec)
    };

    let duration = pcm_data.len() as f64 / (spec.sample_rate as f64 * spec.channels as f64);
    Ok(PcmResult {
        data: pcm_data,
        sample_rate: spec.sample_rate,
        channels: spec.channels,
        duration_secs: duration,
        progress: 100.0,
    })
}

#[wasm_bindgen]
pub struct StreamingConverter {
    decoder: Option<Box<dyn Decoder>>,
    format: Option<Box<dyn FormatReader>>,
    spec: Option<WavSpec>,
    buffer: Vec<i16>,
    input_buffer: Vec<u8>,
    total_packets: u64,
    processed_packets: u64,
}

#[wasm_bindgen]
impl StreamingConverter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<StreamingConverter, JsValue> {
        console_error_panic_hook::set_once();
        Ok(StreamingConverter {
            decoder: None,
            format: None,
            spec: None,
            buffer: Vec::with_capacity(4096),
            input_buffer: Vec::with_capacity(1024 * 1024),
            total_packets: 0,
            processed_packets: 0,
        })
    }

    pub fn append_data(&mut self, data: &[u8]) -> Result<(), JsValue> {
        if data.is_empty() {
            return Err(JsValue::from_str("Empty data provided"));
        }
        self.input_buffer.extend_from_slice(data);
        Ok(())
    }

    pub fn process(&mut self, target_sample_rate: Option<u32>, output_format: &str) -> Result<JsValue, JsValue> {
        if self.decoder.is_none() {
            if !self.input_buffer.is_empty() {
                let input_buffer = self.input_buffer.clone();
                self.initialize_decoder(&input_buffer)?;
                self.input_buffer.clear();
            }
            return Ok(JsValue::NULL);
        }

        let format = self.format.as_mut().unwrap();
        let decoder = self.decoder.as_mut().unwrap();
        let spec = self.spec.unwrap();
        let _channel_count = spec.channels as usize;

        self.buffer.clear();

        while let Ok(packet) = format.next_packet() {
            self.processed_packets += 1;

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    let signal_spec = SignalSpec::new(spec.sample_rate, Channels::from_bits_truncate(spec.channels as u32));
                    let mut sample_buffer = SampleBuffer::<i16>::new(decoded.capacity() as u64, signal_spec);
                    sample_buffer.copy_interleaved_ref(decoded);
                    let samples = sample_buffer.samples();
                    self.buffer.extend_from_slice(samples);

                    if self.buffer.len() >= 4096 {
                        let (pcm_data, spec) = if let Some(target_sr) = target_sample_rate {
                            resample_audio(&self.buffer, &spec, target_sr)?
                        } else {
                            (self.buffer.clone(), spec)
                        };

                        let duration = pcm_data.len() as f64 / (spec.sample_rate as f64 * spec.channels as f64);
                        let progress = if self.total_packets > 0 {
                            (self.processed_packets as f32 / self.total_packets as f32) * 100.0
                        } else {
                            0.0
                        };

                        match output_format.to_lowercase().as_str() {
                            "wav" => {
                                let wav_data = encode_wav(&pcm_data, spec)?;
                                return Ok(JsValue::from(WavResult {
                                    data: wav_data,
                                    sample_rate: spec.sample_rate,
                                    channels: spec.channels,
                                    duration_secs: duration,
                                    progress,
                                }));
                            }
                            "pcm" => {
                                return Ok(JsValue::from(PcmResult {
                                    data: pcm_data,
                                    sample_rate: spec.sample_rate,
                                    channels: spec.channels,
                                    duration_secs: duration,
                                    progress,
                                }));
                            }
                            _ => return Err(JsValue::from_str("Unsupported output format")),
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        if !self.buffer.is_empty() {
            let (pcm_data, spec) = if let Some(target_sr) = target_sample_rate {
                resample_audio(&self.buffer, &spec, target_sr)?
            } else {
                (self.buffer.clone(), spec)
            };

            let duration = pcm_data.len() as f64 / (spec.sample_rate as f64 * spec.channels as f64);
            let progress = if self.total_packets > 0 {
                (self.processed_packets as f32 / self.total_packets as f32) * 100.0
            } else {
                100.0
            };

            match output_format.to_lowercase().as_str() {
                "wav" => {
                    let wav_data = encode_wav(&pcm_data, spec)?;
                    Ok(JsValue::from(WavResult {
                        data: wav_data,
                        sample_rate: spec.sample_rate,
                        channels: spec.channels,
                        duration_secs: duration,
                        progress,
                    }))
                }
                "pcm" => {
                    Ok(JsValue::from(PcmResult {
                        data: pcm_data,
                        sample_rate: spec.sample_rate,
                        channels: spec.channels,
                        duration_secs: duration,
                        progress,
                    }))
                }
                _ => Err(JsValue::from_str("Unsupported output format")),
            }
        } else {
            Ok(JsValue::NULL)
        }
    }

    pub fn finalize(&mut self, target_sample_rate: Option<u32>, output_format: &str) -> Result<JsValue, JsValue> {
        let spec = self.spec.ok_or(JsValue::from_str("No format initialized"))?;
        let mut pcm_data = Vec::new();
        let mut total_samples = 0;

        // Process any remaining packets in the format
        if let (Some(format), Some(decoder)) = (self.format.as_mut(), self.decoder.as_mut()) {
            let signal_spec = SignalSpec::new(spec.sample_rate, Channels::from_bits_truncate(spec.channels as u32));
            let mut sample_buffer = SampleBuffer::<i16>::new(0, signal_spec);

            while let Ok(packet) = format.next_packet() {
                self.processed_packets += 1;

                match decoder.decode(&packet) {
                    Ok(decoded) => {
                        sample_buffer.copy_interleaved_ref(decoded);
                        let samples = sample_buffer.samples();
                        total_samples += samples.len();
                        pcm_data.extend_from_slice(samples);
                    }
                    Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
                    Err(e) => return Err(JsValue::from_str(&e.to_string())),
                }
            }
        }

        // Include any remaining buffered data
        if !self.buffer.is_empty() {
            pcm_data.extend_from_slice(&self.buffer);
            total_samples += self.buffer.len();
            self.buffer.clear();
        }

        // Resample if needed
        let (pcm_data, final_spec) = if let Some(target_sr) = target_sample_rate {
            resample_audio(&pcm_data, &spec, target_sr)?
        } else {
            (pcm_data, spec)
        };

        let duration = total_samples as f64 / (final_spec.sample_rate as f64 * final_spec.channels as f64);
        let progress = if self.total_packets > 0 {
            (self.processed_packets as f32 / self.total_packets as f32) * 100.0
        } else {
            100.0
        };

        match output_format.to_lowercase().as_str() {
            "wav" => {
                let wav_data = encode_wav(&pcm_data, final_spec)?;
                Ok(JsValue::from(WavResult {
                    data: wav_data,
                    sample_rate: final_spec.sample_rate,
                    channels: final_spec.channels,
                    duration_secs: duration,
                    progress,
                }))
            }
            "pcm" => {
                Ok(JsValue::from(PcmResult {
                    data: pcm_data,
                    sample_rate: final_spec.sample_rate,
                    channels: final_spec.channels,
                    duration_secs: duration,
                    progress,
                }))
            }
            _ => Err(JsValue::from_str("Unsupported output format")),
        }
    }

    fn initialize_decoder(&mut self, initial_data: &[u8]) -> Result<(), JsValue> {
        let mss = MediaSourceStream::new(Box::new(Cursor::new(initial_data.to_vec())), Default::default());
        let mut hint = Hint::new();
        hint.with_extension("mp3");

        let format_opts = FormatOptions { enable_gapless: true, ..Default::default() };
        let metadata_opts = MetadataOptions::default();
        let decoder_opts = DecoderOptions { verify: true, ..Default::default() };

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let format = probed.format;
        let track = format
            .default_track()
            .ok_or(JsValue::from_str("No default track"))?;

        let sample_rate = track
            .codec_params
            .sample_rate
            .ok_or(JsValue::from_str("No sample rate"))?;
        let channels = track
            .codec_params
            .channels
            .ok_or(JsValue::from_str("No channels"))?;
        let channel_count = channels.count() as u16;
        self.total_packets = track.codec_params.n_frames.unwrap_or(0);

        self.spec = Some(WavSpec {
            channels: channel_count,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        });

        let decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &decoder_opts)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.decoder = Some(decoder);
        self.format = Some(format);

        Ok(())
    }
}