"""
Knowledge Repository — the Story Engine and Knowledge Base data source for
Kathakali mudras, facial expressions (Navarasa), cultural knowledge, and stories.

Powered entirely by organized local JSON files in backend/app/data/
(mudras.json, expressions.json, cultural_knowledge.json, stories.json),
requiring zero database persistence or network round-trips.
"""
from functools import lru_cache
import json
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class KnowledgeRepository:
    def __init__(self, data_dir: Path | str = _DATA_DIR):
        self.data_dir = Path(data_dir)
        self._mudras: list[dict] = self._load_json("mudras.json")
        self._expressions: list[dict] = self._load_json("expressions.json")
        self._articles: list[dict] = self._load_json("cultural_knowledge.json")
        self._stories: list[dict] = self._load_json("stories.json")

        # In-memory index maps for fast O(1) lookup
        self._mudra_by_name = {m["name"].lower(): m for m in self._mudras}
        self._mudra_by_id = {str(m.get("id", m.get("_id", ""))).lower(): m for m in self._mudras}

        self._expr_by_name = {e["name"].lower(): e for e in self._expressions}
        self._expr_by_id = {str(e.get("id", e.get("_id", ""))).lower(): e for e in self._expressions}

        self._articles_by_id = {str(a.get("id", a.get("_id", ""))): a for a in self._articles}
        self._stories_by_id = {str(s.get("id", "")): s for s in self._stories}

    def _load_json(self, filename: str) -> list[dict]:
        file_path = self.data_dir / filename
        if not file_path.is_file():
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    async def get_mudra_meaning(self, name: str) -> str | None:
        if not name:
            return None
        item = self._mudra_by_name.get(name.strip().lower())
        if item:
            return item.get("meaning")
        return None

    async def get_expression_tone(self, name: str) -> str | None:
        if not name:
            return None
        item = self._expr_by_name.get(name.strip().lower())
        if item:
            return item.get("tone")
        return None

    async def list_mudras(self) -> list[dict]:
        return self._mudras

    async def get_mudra(self, identifier: str) -> dict | None:
        key = identifier.strip().lower()
        return self._mudra_by_name.get(key) or self._mudra_by_id.get(key)

    async def list_expressions(self) -> list[dict]:
        return self._expressions

    async def get_expression(self, identifier: str) -> dict | None:
        key = identifier.strip().lower()
        return self._expr_by_name.get(key) or self._expr_by_id.get(key)

    async def list_articles(self, category: str | None = None) -> list[dict]:
        if not category:
            return self._articles
        cat = category.strip().lower()
        return [a for a in self._articles if a.get("category", "").lower() == cat]

    async def get_article(self, article_id: str) -> dict | None:
        return self._articles_by_id.get(article_id)

    async def list_stories(self) -> list[dict]:
        return self._stories

    async def get_story(self, story_id: str) -> dict | None:
        return self._stories_by_id.get(story_id)


@lru_cache
def get_knowledge_repository() -> KnowledgeRepository:
    """Singleton instance loaded from local JSON files."""
    return KnowledgeRepository()
