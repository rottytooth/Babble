import os
import logging
import uvicorn
from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from databases import Database
from fastapi.logger import logger
from flasgger import Schema, Swagger

from config import ConfigLoader
from lexicon_dao import Lexicon

envsettings = ConfigLoader.get_config()['Environment']
prefix = '' # no prefix for now
logger.setLevel(envsettings['LogLevel'])

database = Database("sqlite:///BabbleLexicon.db")

app = FastAPI(
    title='Babble API',
    version='0.0.1',
    docs_url=f'{prefix}/docs',
    redoc_url=f'{prefix}/redoc',
    openapi_url=f'{prefix}/docs/openapi.json'
)

swagger_config = Swagger.DEFAULT_CONFIG
swagger_config['specs_route'] = f'{prefix}/docs/'


@app.on_event("startup")
async def database_connect():
    await database.connect()

@app.on_event("shutdown")
async def database_disconnect():
    await database.disconnect()


@app.get("/")
async def root():
    return {"message": f"{app.title} version {app.version}"}

@app.get('/resolve/{cmd_name}')
async def Resolve(cmd_name:str):
    lexicon = Lexicon(database)
    definition = await lexicon.resolve(cmd_name)
    return Response(content=f'{{"{cmd_name}":"{definition}"}}', media_type="application/json")

@app.post('/assign')
async def Assign(cmd_name:str, definition:str):
    lexicon = Lexicon(database)
    result = await lexicon.assign(cmd_name, definition)
    return Response(content=f'{{"result":"{result}"}}', media_type="application/json")



def start():
    uvicorn.run(app, host="0.0.0.0", port=os.getenv('PORT', 8000))


if __name__ == '__main__':
    start()
else:
    uvicorn_logger = logging.getLogger('uvicorn')
    logger.handlers = uvicorn_logger.handlers