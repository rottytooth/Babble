from pydantic import BaseModel

class TermDefinition(BaseModel):
    term: str
    definition: str
    params: str | None = None
    line: str
    creator: str | None = None
    doc: str | None = None
