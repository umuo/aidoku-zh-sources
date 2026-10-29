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

const BASE_URL: &str = "https://www.guazimanhua.com";
const CATEGORIES: [&str; 24] = [
	"", "41", "9", "29", "5", "42", "8", "23", "25", "31", "22", "21", "54", "11", "30", "15",
	"13", "14", "148", "97", "55", "61", "17", "27",
];
const REGIONS: [&str; 6] = ["", "42", "43", "77", "78", "338"];
const STATUS: [&str; 3] = ["", "2", "1"];
const SORT: [&str; 5] = ["", "daily", "hits", "update", "score"];

fn parse_error() -> AidokuError {
	NodeError::ParseError.into()
}

fn numeric_id(id: &str) -> Result<&str> {
	if id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_digit()) {
		return Err(parse_error());
	}
	Ok(id)
}

fn link_id(link: &str) -> Result<String> {
	let id = link.split_once("?id=").ok_or_else(parse_error)?.1;
	Ok(numeric_id(id.split('&').next().unwrap_or_default())?.to_string())
}

fn image_url(url: String) -> Result<String> {
	if url.starts_with("//") {
		Ok(format!("https:{}", url))
	} else if url.starts_with('/') {
		Ok(format!("{}{}", BASE_URL, url))
	} else if url.starts_with("https://") || url.starts_with("http://") {
		Ok(url)
	} else {
		Err(parse_error())
	}
}

#[get_manga_list]
fn get_manga_list(filters: Vec<Filter>, page: i32) -> Result<MangaPageResult> {
	let mut url = format!("{}/category.php?page={}", BASE_URL, page.max(1));
	for filter in filters {
		match filter.kind {
			FilterType::Title => {
				url.push_str(&format!(
					"&keyword={}",
					encode_uri_component(filter.value.as_string()?.read())
				));
			}
			FilterType::Select => {
				let index = filter.value.as_int()? as usize;
				let (key, values): (&str, &[&str]) = match filter.name.as_str() {
					"题材" => ("cid", &CATEGORIES),
					"地区" => ("city", &REGIONS),
					"状态" => ("is_end", &STATUS),
					"排序" => ("sort", &SORT),
					_ => continue,
				};
				let value = values.get(index).ok_or_else(parse_error)?;
				if !value.is_empty() {
					url.push_str(&format!("&{}={}", key, value));
				}
			}
			_ => continue,
		}
	}
	let html = Request::new(url, HttpMethod::Get).html()?;
	let mut manga = Vec::new();
	for item in html.select(".grid > .card").array() {
		let item = item.as_node()?;
		let id = link_id(&item.select("h3 a").attr("href").read())?;
		let title = item.select("h3 a").text().read().trim().to_string();
		if title.is_empty() {
			return Err(parse_error());
		}
		manga.push(Manga {
			url: format!("{}/comic.php?id={}", BASE_URL, id),
			id,
			title,
			cover: image_url(item.select("img.cover").attr("src").read())?,
			..Default::default()
		});
	}
	let next = format!("page={}", page.max(1) + 1);
	let has_more = html
		.select(".pagination a, nav.pager a")
		.array()
		.any(|item| {
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
	let url = format!("{}/comic.php?id={}", BASE_URL, numeric_id(&id)?);
	let html = Request::new(url.clone(), HttpMethod::Get).html()?;
	let title = html
		.select("#cinema-title")
		.text()
		.read()
		.trim()
		.to_string();
	if title.is_empty() {
		return Err(parse_error());
	}
	let status = match html
		.select(".cinema-info .meta span.badge")
		.text()
		.read()
		.trim()
	{
		"连载" => MangaStatus::Ongoing,
		"完结" => MangaStatus::Completed,
		_ => MangaStatus::Unknown,
	};
	Ok(Manga {
		id,
		url,
		title,
		cover: image_url(html.select("img.cinema-cover").attr("src").read())?,
		author: html
			.select(".cinema-strip a[href^='/author.php']")
			.text()
			.read(),
		description: html.select(".cinema-info > p").text().read(),
		categories: html
			.select(".cinema-info .meta a.badge")
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
	let url = format!("{}/comic.php?id={}", BASE_URL, numeric_id(&id)?);
	let html = Request::new(url, HttpMethod::Get).html()?;
	let mut chapters = Vec::new();
	// 仅取完整的桌面目录，避免重复收录移动端和“最新章节”入口；
	// 网页按新到旧排列。
	for item in html.select("[data-chapter-list] a").array() {
		let item = item.as_node()?;
		let id = link_id(&item.attr("href").read())?;
		chapters.push(Chapter {
			url: format!("{}/chapter.php?id={}", BASE_URL, id),
			id,
			title: item.text().read().trim().to_string(),
			lang: String::from("zh"),
			..Default::default()
		});
	}
	if chapters.is_empty() {
		return Err(parse_error());
	}
	let count = chapters.len();
	for (index, chapter) in chapters.iter_mut().enumerate() {
		chapter.chapter = (count - index) as f32;
	}
	Ok(chapters)
}

#[get_page_list]
fn get_page_list(_manga_id: String, chapter_id: String) -> Result<Vec<Page>> {
	let url = format!("{}/chapter.php?id={}", BASE_URL, numeric_id(&chapter_id)?);
	let html = Request::new(url, HttpMethod::Get).html()?;
	let mut pages = Vec::new();
	for (index, item) in html
		.select(".reader-images img.reading-image")
		.array()
		.enumerate()
	{
		let item = item.as_node()?;
		pages.push(Page {
			index: index as i32,
			url: image_url(item.attr("src").read())?,
			..Default::default()
		});
	}
	if pages.is_empty() {
		return Err(parse_error());
	}
	Ok(pages)
}

#[modify_image_request]
fn modify_image_request(request: Request) {
	request.header("Referer", &format!("{}/", BASE_URL));
}
