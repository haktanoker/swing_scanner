from typing import Dict, Any


class Coin:
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.timeframes: Dict[str, Dict[str, Any]] = {}
        self.score: int = 0
