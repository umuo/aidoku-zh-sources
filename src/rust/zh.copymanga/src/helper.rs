use aidoku::{
	error::{AidokuError, AidokuErrorKind, Result},
	helpers::uri::encode_uri,
	prelude::*,
	std::{
		html::Node,
		net::{HttpMethod, Request},
		ObjectRef, String,
	},
};

use crate::crypto;

const WWW_URL: &str = "https://www.mangacopy.com";
const API_URL: &str = "https://api.mangacopy.com/api/v3";
const APP_VERSION: &str = "3.0.0";
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

pub fn decode_error() -> AidokuError {
	AidokuError {
		reason: AidokuErrorKind::JsonParseError,
	}
}

pub fn chapter_key(text: &str, preferred: &str) -> Result<String> {
	for name in [preferred, "ccz"] {
		for (start, _) in text.match_indices(name) {
			if text[..start]
				.chars()
				.next_back()
				.map(|character| character.is_ascii_alphanumeric() || character == '_')
				.unwrap_or(false)
			{
				continue;
			}
			let value = text[start + name.len()..].trim_start();
			let Some(value) = value.strip_prefix('=').map(str::trim_start) else {
				continue;
			};
			let Some(quote @ ('\'' | '"')) = value.chars().next() else {
				continue;
			};
			let key = value[1..].split(quote).next().unwrap_or_default();
			if key.len() == 16 {
				return Ok(String::from(key));
			}
		}
	}
	Err(decode_error())
}

pub fn decrypt(text: String, key: String) -> Result<String> {
	let text = text.as_bytes();
	let key = key.as_bytes();
	let key: &[u8; 16] = key.try_into().map_err(|_| decode_error())?;
	if text.len() < 16 {
		return Err(decode_error());
	}
	let iv = &text[..16];
	let cipher = &text[16..];
	let cipher = hex::decode(cipher).map_err(|_| decode_error())?;
	let pt = crypto::decrypt(&cipher, key, iv).map_err(|_| decode_error())?;
	String::from_utf8(pt).map_err(|error| AidokuError::from(error.utf8_error()))
}

pub fn get_text(url: String) -> Result<String> {
	Request::new(url.clone(), HttpMethod::Get)
		.header("User-Agent", UA)
		.string()
}

pub fn get_html(url: String) -> Result<Node> {
	Request::new(url.clone(), HttpMethod::Get)
		.header("User-Agent", UA)
		.html()
}

pub fn json_request(url: String) -> Request {
	let request = Request::new(url.clone(), HttpMethod::Get);

	if url.starts_with(WWW_URL) {
		request.header("User-Agent", UA)
	} else {
		request
			.header("User-Agent", &format!("COPY/{}", APP_VERSION))
			.header("version", APP_VERSION)
			.header("platform", "3")
			.header("region", "1")
			.header("webp", "1")
	}
}

pub fn get_json(url: String) -> Result<ObjectRef> {
	json_request(url).json()?.as_object()
}

pub fn gen_explore_url(theme: String, top: String, ordering: String, page: i32) -> String {
	format!(
		"{}/comics?theme={}&top={}&ordering={}&limit={}&offset={}",
		API_URL,
		theme,
		top,
		ordering,
		50,
		(page - 1) * 50,
	)
}

pub fn gen_search_url(query: String, page: i32) -> String {
	format!(
		"{}/search/comic?q={}&q_type={}&limit={}&offset={}",
		API_URL,
		encode_uri(query),
		"",
		20,
		(page - 1) * 20
	)
}

pub fn gen_rank_url(date_type: String, page: i32) -> String {
	format!(
		"{}/ranks?date_type={}&limit={}&offset={}",
		API_URL,
		date_type,
		30,
		(page - 1) * 30,
	)
}

pub fn gen_recs_url(page: i32) -> String {
	format!(
		"{}/recs?pos={}&limit={}&offset={}",
		API_URL,
		"3200102",
		30,
		(page - 1) * 30,
	)
}

pub fn gen_newest_url(page: i32) -> String {
	format!(
		"{}/update/newest?limit={}&offset={}",
		API_URL,
		30,
		(page - 1) * 30,
	)
}

pub fn gen_manga_url(id: String) -> String {
	format!("{}/comic/{}", WWW_URL, id)
}

// pub fn gen_manga_details_url(id: String) -> String {
// 	format!("{}/comic2/{}", API_URL, id)
// }

pub fn gen_chapter_list_url(id: String) -> String {
	format!("{}/comicdetail/{}/chapters", WWW_URL, id)
}

pub fn gen_chapter_url(manga_id: String, chapter_id: String) -> String {
	format!("{}/comic/{}/chapter/{}", WWW_URL, manga_id, chapter_id)
}

pub fn gen_page_list_url(manga_id: String, chapter_id: String) -> String {
	format!("{}/comic/{}/chapter/{}", WWW_URL, manga_id, chapter_id)
}
