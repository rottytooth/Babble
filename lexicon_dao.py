from databases import Database 
from fastapi import HTTPException
from sqlite3 import IntegrityError
import json

class LexicalException(Exception):
    pass

# global cache of Lexicon
class Lexicon():

    resolve_query = "SELECT Params, Definition, Line FROM Term WHERE Name=:name"

    insert_query = "INSERT INTO Term (Name, Params, ParamNum, Definition, Line, Creator) VALUES (:name, :params, :paramcount, :def, :line, :creator)"

    def __init__(self, db:Database):
        self.database = db

    async def resolve(self, name:str):
        values = {"name": name}
        results = await self.database.fetch_all(query=Lexicon.resolve_query, values=values)
        if len(results) == 1:
            retpacket = {"name":name,"params":results[0]["Params"],"definition":results[0]["Definition"]}
            return json.dumps(retpacket)
        elif len(results) == 0:
            raise HTTPException(status_code=404, detail="Term is unknown")
        else:
            # log error here
            raise LexicalException

    async def assign(self, name:str, definition:str, line:str, creator:str, params:str=None):
        if not params:
            params = "null"
            param_count = 0
        else:
            param_count = params.count(",")+1
        values = {"name": name, "params": params, "paramcount": param_count, "def": definition, "line": line, "creator": creator}
        try:
            results = await self.database.execute(query=Lexicon.insert_query, values=values)
            print(results)
        except IntegrityError as ie:
            # get the real definition of the term, since assignment could not happen
            old_def = await self.database.fetch_all(query=Lexicon.resolve_query, values={"name": name})

            # only get the line, nothing else
            old_def = old_def[0][2]

            raise HTTPException(status_code=409, detail=old_def)
        except Exception as ex:
            # log error here
            raise HTTPException(status_code=500, detail=ex)
            
        return "{complete}"
