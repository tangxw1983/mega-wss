title wss
@echo off
:LBLSTART
@rem port server_id...
node.exe "../index.js" 3333 TestServer

echo exitcode=%errorlevel%

if %errorlevel%==3 goto LBLENDPAUSE

@rem http://wenku.baidu.com/link?url=NL0nhGfVOrQJnR6RdR4842QTw-jdVhgN6jlfug6c-tsE24FvRisF2u2oUwOAvLD6W8dAV4BRwWruWymgOM2M7RrXfxcKMc1lzajcj6DA55G

goto LBLSTART

:LBLENDPAUSE
pause

:LBLEND
