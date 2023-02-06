from databases import Database 
from fastapi import HTTPException
from sqlite3 import IntegrityError
import json

from models.term_definition import TermDefinition

class LexicalException(Exception):
    pass

# global cache of Lexicon
class Lexicon():

    resolve_query = "SELECT Params, Definition, Line FROM Term WHERE Name=:name;"

    resolve_doc_query = "SELECT Doc FROM Term WHERE Name=:name;"

    insert_query = "INSERT INTO Term (Name, Params, ParamNum, Definition, Line, Creator, Doc) VALUES (:name, :params, :paramcount, :def, :line, :creator, :doc);"

    def __init__(self, db:Database):
        self.database = db

    async def resolve(self, name:str):
        values = {"name": name}
        results = await self.database.fetch_all(query=Lexicon.resolve_query, values=values)
        if len(results) == 1:
            params = results[0]["Params"]
            if params == "null":
                params = []
            else:
                params = json.loads(params)
            definition = json.loads(results[0]["Definition"])
            retpacket = {"name":name,"params":params,"definition":definition,"line":results[0]["Line"]}
            return json.dumps(retpacket)
        elif len(results) == 0:
            raise HTTPException(status_code=404, detail="Term is unknown")
        else:
            # log error here
            raise LexicalException

    async def resolve_doc(self, name:str):
        values = {"name": name}
        results = await self.database.fetch_all(query=Lexicon.resolve_doc_query, values=values)
        if len(results) == 1:
            return json.dumps({"doc":str(results[0])})
        elif len(results) == 0:
            raise HTTPException(status_code=404, detail="Term is unknown")
        else:
            # log error here
            raise LexicalException

    async def assign(self, termdef:TermDefinition):
        if not termdef.params or termdef.params == "[]":
            params = "null"
            param_count = 0
        else:
            params = termdef.params
            param_count = termdef.params.count(",")+1

        values = {"name": termdef.term, "params": params, "paramcount": param_count, "def": termdef.definition, "line": termdef.line, "creator": termdef.creator, "doc": termdef.doc}

        try:
            results = await self.database.execute(query=Lexicon.insert_query, values=values)
            print(results)
        except IntegrityError as ie:
            # get the real definition of the term, since assignment could not happen
            old_def = await self.database.fetch_all(query=Lexicon.resolve_query, values={"name": termdef.term})

            # only get the line, nothing else
            old_def = old_def[0][2]

            raise HTTPException(status_code=409, detail=old_def)
        except Exception as ex:
            # log error here
            raise HTTPException(status_code=500, detail=ex)
            
        return "{complete}"
