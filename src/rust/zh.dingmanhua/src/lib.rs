#![no_std]
extern crate alloc;

use aidoku::{
	error::{AidokuError, NodeError, Result},
	helpers::uri::encode_uri_component,
	prelude::*,
	std::{
		net::{HttpMethod, Request},
		String, Vec,
	},
	Chapter, Filter, FilterType, Manga, MangaPageResult, MangaStatus, MangaViewer, Page,
};
use alloc::string::ToString;

const BASE_URL: &str = "https://www.dingmanhua.com";
const REGIONS: [i64; 6] = [0, 1, 3, 4, 14, 15];

fn parse_error() -> AidokuError {
	NodeError::ParseError.into()
}

fn numeric_id(id: &str) -> Result<&str> {
	if id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_digit()) {
		return Err(parse_error());
	}
	Ok(id)
}

fn manga_key(id: &str) -> Result<&str> {
	if id.is_empty()
		|| !id
			.bytes()
			.all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
	{
		return Err(parse_error());
	}
	Ok(id)
}

fn resolve_manga_id(id: &str) -> Result<String> {
	manga_key(id)?;
	if numeric_id(id).is_ok() {
		return Ok(id.to_string());
	}
	// 少量作品使用拼音别名；从官方章节链接取得接口所需的数字 ID。
	let html = Request::new(format!("{}/comic/{}.html", BASE_URL, id), HttpMethod::Get).html()?;
	let link = html
		.select("a[href^='/chapter/']")
		.first()
		.attr("href")
		.read();
	let id = link
		.strip_prefix("/chapter/")
		.and_then(|link| link.split_once('-'))
		.ok_or_else(parse_error)?
		.0;
	Ok(numeric_id(id)?.to_string())
}

fn image_url(url: String) -> Result<String> {
	if url.starts_with("//") {
		Ok(format!("https:{}", url))
	} else if url.starts_with('/') && !url.ends_with("loading.svg") {
		Ok(format!("{}{}", BASE_URL, url))
	} else if url.starts_with("https://") || url.starts_with("http://") {
		Ok(url)
	} else {
		Err(parse_error())
	}
}

#[get_manga_list]
fn get_manga_list(filters: Vec<Filter>, page: i32) -> Result<MangaPageResult> {
	let mut title = String::new();
	let mut region = 0;
	let mut tag = 0;
	for filter in filters {
		match filter.kind {
			FilterType::Title => title = filter.value.as_string()?.read(),
			FilterType::Select => {
				let index = filter.value.as_int()?;
				match filter.name.as_str() {
					"地区" => region = *REGIONS.get(index as usize).ok_or_else(parse_error)?,
					"题材" => {
						if !(0..94).contains(&index) {
							return Err(parse_error());
						}
						tag = index;
					}
					_ => continue,
				}
			}
			_ => continue,
		}
	}
	let page = page.max(1);
	// 搜索接口只接受关键词；分类和题材用于浏览目录。
	let url = if title.trim().is_empty() {
		format!(
			"{}/sort?category={}&tag={}&page={}",
			BASE_URL, region, tag, page
		)
	} else {
		format!(
			"{}/search?query={}&page={}",
			BASE_URL,
			encode_uri_component(title),
			page
		)
	};
	let html = Request::new(url, HttpMethod::Get).html()?;
	let mut manga = Vec::new();
	for item in html.select(".manga-grid .manga-card").array() {
		let item = item.as_node()?;
		let link = item.select("a").attr("href").read();
		let id = link
			.strip_prefix("/comic/")
			.and_then(|link| link.strip_suffix(".html"))
			.ok_or_else(parse_error)?;
		let id = manga_key(id)?.to_string();
		let title = item.select(".manga-title").text().read().trim().to_string();
		if title.is_empty() {
			return Err(parse_error());
		}
		let image = item.select("img");
		let mut cover = image.attr("data-src").read();
		if cover.is_empty() {
			cover = image.attr("src").read();
		}
		manga.push(Manga {
			url: format!("{}/comic/{}.html", BASE_URL, id),
			id,
			title,
			cover: image_url(cover)?,
			..Default::default()
		});
	}
	let next = format!("page={}", page + 1);
	let has_more = html.select(".pagination a[href]").array().any(|item| {
		item.as_node()
			.map(|node| {
				node.attr("href")
					.read()
					.split('?')
					.nth(1)
					.unwrap_or_default()
					.split('&')
					.any(|parameter| parameter == next)
			})
			.unwrap_or(false)
	});
	Ok(MangaPageResult { manga, has_more })
}

#[get_manga_details]
fn get_manga_details(id: String) -> Result<Manga> {
	let url = format!("{}/comic/{}.html", BASE_URL, manga_key(&id)?);
	let html = Request::new(url.clone(), HttpMethod::Get).html()?;
	let title = html.select("#mangaTitle").text().read().trim().to_string();
	if title.is_empty() {
		return Err(parse_error());
	}
	let status = match html
		.select(".meta-status > span:last-child")
		.text()
		.read()
		.trim()
	{
		"连载中" | "连载" => MangaStatus::Ongoing,
		"已完结" | "完结" => MangaStatus::Completed,
		_ => MangaStatus::Unknown,
	};
	Ok(Manga {
		id,
		url,
		title,
		cover: image_url(html.select("#mangaCover").attr("src").read())?,
		author: html.select("#mangaAuthor").text().read(),
		description: html.select("#mangaDescription").text().read(),
		categories: html
			.select("#mangaTags .tag")
			.array()
			.filter_map(|item| item.as_node().ok().map(|node| node.text().read()))
			.collect(),
		status,
		viewer: MangaViewer::Scroll,
		..Default::default()
	})
}

#[get_chapter_list]
fn get_chapter_list(id: String) -> Result<Vec<Chapter>> {
	let id = resolve_manga_id(&id)?;
	// 网页初始目录最多 25 章，必须调用站点加载完整目录的接口。
	let response = Request::new(
		format!("{}/comic/{}", BASE_URL, numeric_id(&id)?),
		HttpMethod::Post,
	)
	.header("Content-Type", "application/json")
	.body(b"{}")
	.json()?
	.as_object()?;
	if response.get("code").as_int()? != 0 {
		return Err(parse_error());
	}
	let entries = response
		.get("data")
		.as_object()?
		.get("chapters")
		.as_array()?;
	let mut chapters = Vec::new();
	for item in entries {
		let item = item.as_object()?;
		let chapter_id = item.get("id").as_int()?;
		let title = item
			.get("chapterName")
			.as_string()?
			.read()
			.trim()
			.to_string();
		if chapter_id <= 0 || item.get("contentId").as_int()?.to_string() != id || title.is_empty()
		{
			return Err(parse_error());
		}
		chapters.push(Chapter {
			id: chapter_id.to_string(),
			title,
			url: format!("{}/chapter/{}-{}.html", BASE_URL, id, chapter_id),
			lang: String::from("zh"),
			..Default::default()
		});
	}
	if chapters.is_empty() {
		return Err(parse_error());
	}
	let count = chapters.len();
	for (index, chapter) in chapters.iter_mut().enumerate() {
		// chapterNum 是图片张数，并非章节序号。
		chapter.chapter = (count - index) as f32;
	}
	Ok(chapters)
}

fn assignment<'a>(script: &'a str, name: &str) -> Result<&'a str> {
	let value = script
		.split_once(name)
		.ok_or_else(parse_error)?
		.1
		.trim_start();
	let value = value
		.strip_prefix('=')
		.ok_or_else(parse_error)?
		.trim_start();
	Ok(value
		.split([';', '\n', '\r'])
		.next()
		.unwrap_or_default()
		.trim())
}

fn quoted(value: &str) -> Result<&str> {
	let quote = value.as_bytes().first().ok_or_else(parse_error)?;
	if (*quote != b'"' && *quote != b'\'')
		|| value.len() < 2
		|| value.as_bytes().last() != Some(quote)
	{
		return Err(parse_error());
	}
	let inner = &value[1..value.len() - 1];
	if inner.contains(['"', '\'']) {
		return Err(parse_error());
	}
	Ok(inner)
}

#[get_page_list]
fn get_page_list(manga_id: String, chapter_id: String) -> Result<Vec<Page>> {
	let html = Request::new(
		format!(
			"{}/chapter/{}-{}.html",
			BASE_URL,
			resolve_manga_id(&manga_id)?,
			numeric_id(&chapter_id)?
		),
		HttpMethod::Get,
	)
	.html()?;
	for script in html.select("script").array() {
		let script = script.as_node()?.data().read();
		if !script.contains("var num") || !script.contains("var pasd") {
			continue;
		}
		// 只解析站点的数字和 URL 字面量，不执行 eval 或任意脚本。
		let count = assignment(&script, "var num")?;
		let count = count
			.strip_prefix("eval(")
			.and_then(|count| count.strip_suffix(')'))
			.ok_or_else(parse_error)?;
		let count = quoted(count.trim())?;
		numeric_id(count)?;
		let count = count.parse::<usize>().map_err(|_| parse_error())?;
		if count == 0 || count > 2000 {
			return Err(parse_error());
		}
		let prefix = quoted(assignment(&script, "var pasd")?)?.replace("\\/", "/");
		let prefix = image_url(prefix)?;
		if !prefix.ends_with('/') || prefix.contains(['\\', '?', '#']) {
			return Err(parse_error());
		}
		return Ok((0..count)
			.map(|index| Page {
				index: index as i32,
				url: format!("{}{}.webp", prefix, index + 1),
				..Default::default()
			})
			.collect());
	}
	Err(parse_error())
}

#[modify_image_request]
fn modify_image_request(request: Request) {
	request.header("Referer", &format!("{}/", BASE_URL));
}
