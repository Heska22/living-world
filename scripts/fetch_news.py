#!/usr/bin/env python3
"""
Busca notícias de Mundo, Brasil e Maringá (várias fontes locais + Google News RSS,
sem precisar de API key de notícia), gera um resumo curto + tag de assunto com a
API da Anthropic, e publica em /data/news.json + /data/archive/AAAA-MM-DD.json.
"""
import hashlib
import json
import os
import time
from datetime import datetime, timezone

import feedparser
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; JornalBot/1.0)"}

# Cada categoria pode ter mais de uma fonte RSS. Se uma fonte falhar ou mudar de
# formato, o script simplesmente ignora aquela fonte e segue com as outras.
FEEDS = {
    "Mundo": [
        "https://news.google.com/rss/headlines/section/topic/WORLD?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    ],
    "Brasil": [
        "https://news.google.com/rss/headlines/section/topic/NATION?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    ],
    "Maringá": [
        "https://news.google.com/rss/search?q=Maring%C3%A1&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "https://odiariodemaringa.com.br/feed/",
        "https://omaringa.com.br/feed/",
    ],
}

ITEMS_PER_CATEGORY = 10
FETCH_TIMEOUT = 6
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"  # rápido e barato, ideal pra rodar em lote todo dia


def clean_title(raw_title, source_hint):
    # Google News costuma vir "Título - Nome da Fonte"; feeds próprios já vêm limpos
    parts = raw_title.rsplit(" - ", 1)
    if len(parts) == 2 and source_hint == "google":
        return parts[0].strip(), parts[1].strip()
    return raw_title.strip(), ""


def get_page_meta(url):
    """Pega og:image, og:video (ou embed do YouTube) e a meta description
    (usada como contexto pro resumo da IA)."""
    image, video, description = None, None, ""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=FETCH_TIMEOUT, allow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")

        img_tag = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
        if img_tag and img_tag.get("content"):
            image = img_tag["content"]

        desc_tag = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
        if desc_tag and desc_tag.get("content"):
            description = desc_tag["content"]

        video_tag = soup.find("meta", property="og:video:secure_url") or soup.find("meta", property="og:video")
        if video_tag and video_tag.get("content"):
            video = video_tag["content"]
        else:
            # procura um embed de YouTube na página (comum em matérias com vídeo)
            iframe = soup.find("iframe", src=lambda s: s and ("youtube.com" in s or "youtube-nocookie.com" in s))
            if iframe and iframe.get("src"):
                video = iframe["src"]
    except Exception:
        pass
    return image, video, description


def summarize_with_ai(title, description, category):
    """Gera um resumo curto (pro card) + uma explicação mais completa (pra página
    da matéria) + uma tag de assunto. Se não houver API key configurada, ou se a
    chamada falhar, volta pra manchete crua sem quebrar o site."""
    if not ANTHROPIC_API_KEY:
        return None, None, None

    prompt = (
        f"Categoria: {category}\n"
        f"Manchete: {title}\n"
        f"Descrição da fonte: {description or '(sem descrição disponível)'}\n\n"
        "Com base só nessas informações (não invente fatos que não estão aqui), "
        "responda APENAS um JSON válido, sem markdown, no formato exato: "
        "{\"resumo\": \"1 frase curta em português, seu próprio texto, pra aparecer "
        "num card de lista\", \"explicacao\": \"4 a 6 frases em português, seu próprio "
        "texto, explicando com mais contexto do que se trata a notícia, pra alguém que "
        "só vai ler isso e não a matéria original\", \"tag\": \"uma palavra ou expressão "
        "curta de 1 a 2 palavras que categorize o assunto, ex: Política, Trânsito, "
        "Educação, Economia, Clima, Segurança, Saúde, Cultura\"}"
    )

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20,
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"].strip()
        text = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        return parsed.get("resumo"), parsed.get("explicacao"), parsed.get("tag")
    except Exception as e:
        print(f"  aviso: resumo por IA falhou para '{title[:40]}...': {e}")
        return None, None, None


def build_category(name, feed_urls):
    seen_titles = set()
    raw_entries = []

    for feed_url in feed_urls:
        source_hint = "google" if "news.google.com" in feed_url else "own"
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"  aviso: não consegui ler o feed {feed_url}: {e}")
            continue

        for entry in feed.entries:
            title, source = clean_title(entry.get("title", ""), source_hint)
            if not title or title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())

            link = entry.get("link", "")
            try:
                published_iso = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                published_iso = datetime.now(timezone.utc).isoformat()

            raw_entries.append({
                "title": title,
                "source": source or name,
                "link": link,
                "published": published_iso,
            })

    # mais recentes primeiro
    raw_entries.sort(key=lambda e: e["published"], reverse=True)
    raw_entries = raw_entries[:ITEMS_PER_CATEGORY]

    entries = []
    for entry in raw_entries:
        image, video, description = get_page_meta(entry["link"])
        resumo, explicacao, tag = summarize_with_ai(entry["title"], description, name)
        entries.append({
            "id": hashlib.md5(entry["link"].encode("utf-8")).hexdigest()[:10],
            **entry,
            "image": image,
            "video": video,
            "resumo": resumo,
            "explicacao": explicacao,
            "tag": tag or name,
        })
    return entries


def main():
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": {},
    }
    for name, urls in FEEDS.items():
        print(f"Buscando categoria: {name}")
        data["categories"][name] = build_category(name, urls)
        time.sleep(1)

    os.makedirs("data/archive", exist_ok=True)

    with open("data/news.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with open(f"data/archive/{today}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # atualiza o índice do arquivo/histórico
    index_path = "data/archive/index.json"
    dates = []
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            dates = json.load(f)
    if today not in dates:
        dates.append(today)
    dates.sort(reverse=True)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(dates, f, ensure_ascii=False, indent=2)

    print("news.json, archive e índice gerados com sucesso.")


if __name__ == "__main__":
    main()
