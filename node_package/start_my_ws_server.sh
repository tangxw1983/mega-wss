#!/bin/sh

while :
do
    node "../index.js" 3333 TestServer > /dev/null
    if [ $? -eq 3 ]; then
        break
    fi
done
