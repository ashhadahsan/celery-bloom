from fastapi import APIRouter
from celery_bloom import celery_client

router = APIRouter(prefix="/api/workers", tags=["workers"])


@router.get("")
def list_workers():
    return celery_client.get_workers()
