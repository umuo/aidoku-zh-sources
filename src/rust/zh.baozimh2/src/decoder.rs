use alloc::{format, string::String, vec::Vec};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

const STANDARD_ALPHABET: &[u8] =
	b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SITE_ALPHABET: &[u8] = b"_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// 还原站点章节图片列表的分段、字符替换和 Base64 编码。
pub fn decode_images(encoded: &str) -> Result<String, ()> {
	let body = encoded
		.strip_prefix("J7r")
		.and_then(|value| value.strip_suffix("nQ"))
		.filter(|value| value.is_ascii())
		.ok_or(())?;
	let length = body
		.len()
		.checked_sub(5)
		.filter(|length| *length > 0)
		.ok_or(())?;
	let tail_length = length / 3;
	let first_length = (length - tail_length) / 2;
	let middle_length = length - tail_length - first_length;
	let middle_start = first_length + 2;
	let marker_start = middle_start + middle_length;

	if &body[first_length..middle_start] != "kD" || &body[marker_start..marker_start + 3] != "W4s" {
		return Err(());
	}

	let reordered = format!(
		"{}{}{}",
		&body[marker_start + 3..],
		&body[..first_length],
		&body[middle_start..marker_start]
	);
	let mut bytes = reordered.into_bytes();
	// 站点每 7 个字符分组，奇数位置的组需要反转。
	for (index, chunk) in bytes.chunks_mut(7).enumerate() {
		if index % 2 == 1 {
			chunk.reverse();
		}
	}
	let translated = bytes
		.iter()
		.map(|byte| {
			SITE_ALPHABET
				.iter()
				.position(|candidate| candidate == byte)
				.map(|index| STANDARD_ALPHABET[index])
				.ok_or(())
		})
		.collect::<Result<Vec<u8>, ()>>()?;
	let decoded = URL_SAFE_NO_PAD.decode(translated).map_err(|_| ())?;
	String::from_utf8(decoded).map_err(|_| ())
}

pub fn image_url(path: &str, line: i64) -> String {
	if path.starts_with("https://") || path.starts_with("http://") {
		return String::from(path);
	}
	if path.starts_with("//") {
		return format!("https:{}", path);
	}
	let host = if line == 2 {
		"https://c-nd2-1.6wm.top"
	} else {
		"https://c-nd3-1.6wm.top"
	};
	format!("{}/{}", host, path.trim_start_matches('/'))
}
