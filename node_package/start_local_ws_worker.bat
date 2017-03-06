title tu

@echo off
:LBLSTART
node.exe "mega-wss" "ws://127.0.0.1:3333/test" TestUser TestPwd

echo exitcode=%errorlevel%

if %errorlevel%==3 goto LBLENDPAUSE

@rem http://wenku.baidu.com/link?url=NL0nhGfVOrQJnR6RdR4842QTw-jdVhgN6jlfug6c-tsE24FvRisF2u2oUwOAvLD6W8dAV4BRwWruWymgOM2M7RrXfxcKMc1lzajcj6DA55G

sleep.exe 1

goto LBLSTART

:LBLENDPAUSE
pause

:LBLEND

