from fastapi import APIRouter, Depends, Query

from app.services.knowledge_repository import KnowledgeRepository, get_knowledge_repository
from app.utils.exceptions import not_found

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/mudras")
async def list_mudras(repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    return await repo.list_mudras()


@router.get("/mudras/{identifier}")
async def get_mudra(identifier: str, repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    mudra = await repo.get_mudra(identifier)
    if not mudra:
        raise not_found("Mudra")
    return mudra


@router.get("/expressions")
async def list_expressions(repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    return await repo.list_expressions()


@router.get("/expressions/{identifier}")
async def get_expression(identifier: str, repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    expr = await repo.get_expression(identifier)
    if not expr:
        raise not_found("Expression")
    return expr


@router.get("/articles")
async def list_articles(
    category: str | None = Query(default=None),
    repo: KnowledgeRepository = Depends(get_knowledge_repository),
):
    return await repo.list_articles(category)


@router.get("/articles/{article_id}")
async def get_article(article_id: str, repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    doc = await repo.get_article(article_id)
    if not doc:
        raise not_found("Article")
    return doc


@router.get("/stories")
async def list_stories(repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    return await repo.list_stories()


@router.get("/stories/{story_id}")
async def get_story(story_id: str, repo: KnowledgeRepository = Depends(get_knowledge_repository)):
    story = await repo.get_story(story_id)
    if not story:
        raise not_found("Story")
    return story
