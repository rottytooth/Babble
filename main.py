import os
import logging
import uvicorn
from databases import Database
from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.logger import logger
from fastapi.staticfiles import StaticFiles
from flasgger import Schema, Swagger
from pydantic import BaseModel
from starlette.responses import FileResponse 

from lexicon_dao import Lexicon

prefix = '' # no prefix for now
logger.setLevel('DEBUG')

database = Database("sqlite:///BabbleLexicon.db")

app = FastAPI(
    title='Babble API',
    version='0.1.0',
    docs_url=f'{prefix}/docs',
    redoc_url=f'{prefix}/redoc',
    openapi_url=f'{prefix}/docs/openapi.json'
)

swagger_config = Swagger.DEFAULT_CONFIG
swagger_config['specs_route'] = f'{prefix}/docs/'

class TermDefinition(BaseModel):
    term: str
    definition: str
    params: str | None = None
    line: str
    creator: str | None = None


@app.on_event("startup")
async def database_connect():
    await database.connect()

@app.on_event("shutdown")
async def database_disconnect():
    await database.disconnect()


@app.get("/info")
async def root():
    return {"message": f"{app.title} version {app.version}"}

@app.get('/resolve/{cmd_name}')
async def Resolve(cmd_name:str):
    lexicon = Lexicon(database)
    result = await lexicon.resolve(cmd_name)
    return Response(content=result, media_type="application/json")

@app.post('/assign')
async def Assign(termdef: TermDefinition):
    lexicon = Lexicon(database)
    result = await lexicon.assign(termdef.term, termdef.definition, termdef.line, termdef.creator, termdef.params)
    return Response(content=f'{{"result":"{result}"}}', media_type="application/json")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/src", StaticFiles(directory="src"), name="src")

@app.get("/")
async def read_index():
    return FileResponse('static/console.html')

def start():
    uvicorn.run(app, host="0.0.0.0", port=os.getenv('PORT', 8000))


if __name__ == '__main__':
    start()
else:
    uvicorn_logger = logging.getLogger('uvicorn')
    logger.handlers = uvicorn_logger.handlers