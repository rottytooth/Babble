from databases import Database 
from fastapi import HTTPException
from sqlite3 import IntegrityError

class LexicalException(Exception):
    pass

# global cache of Lexicon
class Lexicon():

    def __init__(self, db:Database):
        self.database = db

    async def resolve(self, name:str):
        query = "SELECT definition FROM Term WHERE Name=:name"
        values = {"name": name}
        results = await self.database.fetch_all(query=query, values=values)
        if len(results) == 1:
            return results[0]
        elif len(results) == 0:
            raise HTTPException(status_code=404, detail="Term is unknown")
        else:
            # log error here
            raise LexicalException

    async def assign(self, name:str, definition:str):
        query = "INSERT INTO Term (Name, Definition) VALUES (:name,:def)"
        values = {"name": name, "def": definition}
        try:
            results = await self.database.execute(query=query, values=values)
            print(results)
        except IntegrityError as ie:
            raise HTTPException(status_code=409, detail="This breaks the integrity of the language. Probably you are trying to define a term already defined")
        except Exception as ex:
            # log error here
            raise HTTPException(status_code=500, detail=ex)
            
        return "{complete}"
