#!/usr/bin/env python3
"""
Busca notícias de Mundo, Brasil e Maringá via Google News RSS (público, sem API key)
e gera /data/news.json, que o site (index.html) consome no navegador do leitor.
"""
import json
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote

import feedparser
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; JornalBot/1.0)"}

FEEDS = {
    "Mundo": "https://news.google.com/rss/headlines/section/topic/WORLD?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    "Brasil": "https://news.google.com/rss/headlines/section/topic/NATION?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    "Maringá": "https://news.google.com/rss/search?q=Maring%C3%A1&hl=pt-BR&gl=BR&ceid=BR:pt-419",
}

ITEMS_PER_CATEGORY = 8
FETCH_TIMEOUT = 6


def clean_title(raw_title):
    # Google News costuma vir "Título - Nome da Fonte"
    parts = raw_title.rsplit(" - ", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return raw_title.strip(), ""


def get_og_image(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=FETCH_TIMEOUT, allow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")
        tag = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
        if tag and tag.get("content"):
            return tag["content"]
    except Exception:
        pass
    return None


def build_category(name, feed_url):
    feed = feedparser.parse(feed_url)
    entries = []
    for entry in feed.entries[:ITEMS_PER_CATEGORY]:
        title, source = clean_title(entry.get("title", ""))
        link = entry.get("link", "")
        published = entry.get("published", "")
        try:
            published_iso = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            published_iso = datetime.now(timezone.utc).isoformat()

        image = get_og_image(link)

        entries.append({
            "title": title,
            "source": source or name,
            "link": link,
            "published": published_iso,
            "image": image,
        })
    return entries


def main():
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": {},
    }
    for name, url in FEEDS.items():
        print(f"Buscando categoria: {name}")
        data["categories"][name] = build_category(name, url)
        time.sleep(1)

    with open("data/news.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("news.json gerado com sucesso.")


if __name__ == "__main__":
    main()
