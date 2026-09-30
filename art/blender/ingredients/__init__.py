"""具材の一覧。

新しい具材を足すときは、このフォルダに具材のファイルを作り、
下の INGREDIENTS に1行追加します（くわしくは README.md）。
並び順 = タコスに盛る順番（先に書いたものが下になる）。
"""
from . import tai, daikon, negi, togarashi

INGREDIENTS = [
    tai,
    daikon,
    negi,
    togarashi,
]
