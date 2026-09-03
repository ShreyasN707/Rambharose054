import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import engines, missions, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nothing to start up yet — websocket.py isn't built.
    # This is a placeholder so the file runs today.
    yield


app = FastAPI(
    title="Digital Twin API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later once frontend origin is known
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(engines.router, prefix="/api")
app.include_router(missions.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")